# Architecture decisions

## ADR-000: Documentation-first skeleton
- Status: accepted
- Reason: prioritize agent-runtime development and fast repo scaffolding while avoiding unverified package commands.
- Consequences: initial repo required full application scaffolding by the autonomous agent.

## ADR-001: RPG engine selection — Phaser 3 + Authoritative TypeScript WebSocket Room Server
- Status: accepted (validated during 15-minute spike)
- Candidate evaluated: RPGJS v4 vs. Phaser 3 (`phaser@^3.87.0`, MIT License) + Express/`ws` authoritative server.
- Decision: Selected **Phaser 3 + Authoritative TypeScript WebSocket Server**.
- Reason:
  1. `docs/architecture/CONTRACTS.md` mandates specific wire message schemas (`join_room`, `move_input`, `interact`, `chat_message` -> `room_snapshot`, `world_delta`, `dialogue`, `agent_decision_summary`, `error` with monotonic `revision` and `requestId`) and server-authoritative A* pathfinding for a 4-adventurer AI party plus human NPC avatars.
  2. RPGJS couples movement and map state to its internal Socket.io decorator pipeline, adding heavy build friction for custom multi-agent party deliberation and Cloud Run single-container deployment.
  3. Phaser 3 (MIT licensed) provides hardware-accelerated 2D tilemap/sprite rendering in the browser while allowing the game logic, collision grid, A* navigation, stat-based combat, quest flags, and Gemini verification gate to live in a pure, deterministic TypeScript module (`src/server/gameEngine.ts`) testable both headlessly in Vitest and live over WebSockets.

## ADR-002: AI provider & model verification
- Status: accepted and verified against live Google AI Studio endpoint
- Provider: Google AI Studio API via official `@google/genai` SDK (`server-side only`).
- Verified accessible models on hackathon credentials:
  - Agent reasoning model: `gemini-4-argon` (`models/gemini-4-argon`, 1M input token limit, 32k output limit, supports `thinking` and structured JSON output).
  - Generative image model: `gemini-nano-banana-2.1` (`models/gemini-nano-banana-2.1`).
- Reliability & cost controls:
  - Batched structured JSON generation with strict Zod schema validation (`src/shared/contracts.ts`).
  - Per-room call cap (`GEMINI_MAX_CALLS_PER_ROOM=60`), bounded timeout (`GEMINI_TIMEOUT_MS=15000`), and automatic deterministic persona-faithful offline fallback (`OFFLINE_AGENT_FALLBACK=true`) clearly tagged in diagnostic traces (`source: 'gemini-4-argon'` vs `source: 'offline_fallback'`).

## ADR-003: IP policy & Asset Provenance
- Status: accepted
- Dragon Quest and 전자오락수호대 are thematic inspirations only; zero proprietary assets, sprites, maps, or names are used.
- Core 16-bit tilesets and 4-direction character/enemy/item sprite sheets are generated programmatically via `scripts/generate-assets.ts` (original CC0 artwork created for this project) supplemented by original emblem/portrait icons generated via `gemini-nano-banana-2.1` where applicable, documented in `docs/assets/ASSET_CREDITS.md`.

## ADR-004: Single-instance Cloud Run topology
- Status: accepted
- A single container built via `Dockerfile` serves both the Vite-bundled Phaser client (`dist/client`) and the Express + `ws` server (`dist/server/index.js`) on `0.0.0.0:$PORT` (default `8080`), with `GET /healthz`, graceful `SIGTERM` handling, and `--max-instances 1` so in-memory multiplayer rooms remain consistent across connected browser tabs.
