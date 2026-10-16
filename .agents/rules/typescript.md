---
trigger: glob
globs: "**/*.ts, **/*.tsx"
description: "TypeScript boundaries for Administration of the Video Game"
---

- Prefer strict TypeScript and explicit schemas for network and Gemini output.
- Keep game-domain types independent of any one rendering framework.
- Never import server secrets or provider SDK into browser code.
- Deterministic reducers and rule validation own game state changes.
- Cover key world transitions with tests and seeded fixtures.
