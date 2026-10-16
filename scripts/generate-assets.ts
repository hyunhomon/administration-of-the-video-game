import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/assets');

// Minimal valid 32x32 16-bit style pixel-art PNG fallback buffer (generated deterministically)
function createFallbackCrestSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128" shape-rendering="crispEdges">
  <rect width="64" height="64" fill="#0b1020"/>
  <rect x="4" y="4" width="56" height="56" fill="#131c31" stroke="#f5c451" stroke-width="4"/>
  <polygon points="32,10 50,22 44,48 32,56 20,48 14,22" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
  <rect x="29" y="16" width="6" height="28" fill="#f5c451"/>
  <rect x="21" y="24" width="22" height="6" fill="#f5c451"/>
  <rect x="27" y="44" width="10" height="6" fill="#e879f9"/>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const svgPath = path.join(OUTPUT_DIR, 'bureau-crest.svg');
  fs.writeFileSync(svgPath, createFallbackCrestSvg(), 'utf8');
  console.log(`Saved procedural pixel crest SVG to ${svgPath}`);

  const apiKey = process.env.GEMINI_API_KEY;
  const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
  const pngPath = path.join(OUTPUT_DIR, 'bureau-emblem.png');

  if (!apiKey) {
    console.log('No GEMINI_API_KEY configured; skipping optional Nano Banana PNG generation.');
    return;
  }

  try {
    console.log(`Requesting supplemental pixel emblem from ${imageModel}...`);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: imageModel,
      contents:
        'Create a 64x64 16-bit retro RPG pixel art emblem for the "Administration of the Video Game": a golden pixelated shield and key over a deep navy background, crisp pixel edges, original art, no text.',
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/')) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        fs.writeFileSync(pngPath, buffer);
        console.log(`Saved Nano Banana generated asset (${buffer.length} bytes) to ${pngPath}`);
        return;
      }
    }
    console.log('Model returned response without inline image data; using procedural SVG crest.');
  } catch (err) {
    console.warn(
      `Optional Nano Banana generation fell back to procedural SVG: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

main();
