# Asset policy and Nano Banana pipeline

## Goal
Get a cohesive original 16-bit-inspired top-down fantasy look quickly. Prefer freely reusable tilesets and sprites with documented rights, and use Nano Banana only to fill gaps (portraits, props, quest panels, optional splash art). Avoid copying identifiable Dragon Quest characters, locations, sprite sheets, logos or UI.

## Workflow
1. Pick one cohesive, license-cleared tileset/sprite source and document license per asset in `ASSET_CREDITS.md`.
2. Generate **original** missing images via Google AI Studio Nano Banana where access permits.
3. Normalize to grid size/palette, pixel-clean edges, alpha background where needed, remove halos and resample nearest-neighbor.
4. Keep generated source images in a clearly named directory, optimized sheets in game assets.
5. Check animation frames and tile seams in browser; record provider/model/prompt/date in the credits file.

## Prompt template
'Create an ORIGINAL top-down 16-bit-inspired fantasy RPG [object/character], readable silhouette, cohesive restrained palette, exact [tile width] pixel grid, transparent background if supported, no text, no logos, not resembling existing franchises. Output [single icon / 4-direction sprite guide / tile motif].'

## Caution
Generated sprite sheets often have inconsistent frame alignment. For core animations use properly licensed sprite sheets first. AI imagery is supplemental, not a dependency for the first playable build.
