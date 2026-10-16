# System architecture — v0.0

## Proposed topology
Browser (RPG client, UI, human chat) ⇄ room server (authoritative world state, movement, quests, combat, persistence)
                                              ⇅
                                     Agent orchestrator (scheduler + party coordinator)
                                              ⇅
                              Google AI Studio Gemini API (server-side only)

## Stack decisions pending spike
- Engine candidate: RPGJS (validate current stable release, licensing, web multiplayer capabilities, server runtime). Alternative: Phaser + thin authoritative room server if RPGJS integration is costly.
- TypeScript end to end. Bun as preferred runtime **where dependencies are compatible**; do not force incompatible tooling.
- In-memory room state for demo; SQLite only if persistence proves necessary. Avoid extra infrastructure.
- Server → clients via WebSocket updates; sequence/revision IDs allow ordering and reconnect snapshots.

## Boundaries
- Engine owns position/collision/pathfinding/item pickup/combat/leveling and persistent world ledger.
- Orchestrator samples snapshots; proposes intent; rules gate validates reachability/resources/ownership.
- Gemini chooses high-level intent, NPC language and contested decisions, **never writes raw authoritative state**.
- Event store captures action outcomes, speaker, claims, evidence, consequence and provenance.

## Tick model
Movement at regular server ticks. Agent reasoning triggered by arrival, interaction, combat outcome, new information, or goal completion. No LLM calls at every animation frame. Deduplicate events and budget calls per minute/room.

## Security
Validate all inputs, enforce chat length/rate limits, sanitize display, cap AI tool calls/token spend, hide secrets, isolate untrusted model output. Human chat is untrusted game-world speech, not developer instructions.

## Latency UX
Animate while intent pending, show thinking indicator sparingly, use bounded timeout and deterministic fallback. Store enough state to resume after failed provider calls.
