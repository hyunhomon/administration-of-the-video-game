# Google AI Studio + Gemini API integration — v0.0

## Provider boundary
Google AI Studio is for API key provisioning, model access discovery and testing; production/game calls go through the server using Google's supported `@google/genai` JavaScript SDK. Do **not** call provider from the browser.

## Runtime settings
Read `GEMINI_API_KEY` from server environment. Set `GEMINI_AGENT_MODEL` to an **actual accessible** model identifier chosen in AI Studio (prefer hackathon-provided Gemini 4 Argon if available). Set `GEMINI_IMAGE_MODEL` to the actual accessible Nano Banana image model ID separately. Model display names are not guaranteed API identifiers. Verify quotas/features with a smoke test.

## Pseudocode (adapt to validated SDK release)
```ts
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const result = await ai.models.generateContent({
  model: process.env.GEMINI_AGENT_MODEL!,
  contents: 'Return a brief in-world NPC greeting.'
});
console.log(result.text);
```

## Agent calls
Use SDK structured output where supported, JSON schema + runtime Zod parsing, limited action vocabulary, bounded retries, cancellation/timeout, per-room budget, sensible safety settings, and usage logging with secrets/redaction. Keep human dialogue as explicitly untrusted contents.

## Image calls
Nano Banana model via official supported image generation call surface when accessible. Some Gemini image variants use `generateContent` with image modalities while other offerings differ; verify actual SDK response parts and save image bytes server-side/offline. Never assume a fixed model ID, aspect ratio option, or 4K capability.

## Notes
Hackathon brief may mention preview product/model names that require special access. Verify within provided Google AI Studio account rather than substituting imaginary public IDs. Use `docs/assets/PIPELINE.md`.

## Official references
- https://ai.google.dev/gemini-api/docs
- https://ai.google.dev/gemini-api/docs/libraries
- https://ai.google.dev/gemini-api/docs/image-generation
- https://aistudio.google.com/


## Important separation of model selectors
The **coding model in Antigravity** should be selected in the IDE as `Gemini 4 Argon` with `High` reasoning if the connected account exposes it. The **in-game model API** is accessed using Google AI Studio credentials; resolve actual available model identifiers from the account, set `GEMINI_AGENT_MODEL`, and test `thinkingLevel: high` support only if the chosen endpoint permits it. Do not hardcode alleged IDs. Use latest official `@google/genai` API contracts after checking docs at implementation time. Never ship keys to the client.
