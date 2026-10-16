# 3-hour autonomous execution plan (targets, not guarantees)

**00:00–00:15** — Confirm candidate engine, asset licenses, actual package versions, `@google/genai`/model API; scaffold app. Choose simpler engine immediately if integration fails.

**00:15–01:00** — Browser game boots, tilemap/collisions, 2 human NPCs in one shared room, text chat, deterministic four-member AI party display and scripted movement.

**01:00–01:45** — Google AI Studio integration, one distinct agent reacts to natural-language speech, typed intents change destination, independent memory/belief store, bounded failures and offline fallback.

**01:45–02:20** — Four personas, party consensus, one quest with two routes; minimal item/XP/stat-based fight, visible reaction panel. Prefer batched inference over 4 high-latency calls.

**02:20–02:45** — Browser E2E critical path, second client sync, reset demo, error handling, LICENSE/attribution, clean build, bug fixing.

**02:45–03:00** — GCP container/deploy if possible, smoke test, screenshots, README commands, honest `STATUS.md`.

## Cut order under schedule pressure
Cut voice, art generation, animations, extra NPCs, more maps, equipment UI, complex combat, 4 separate model calls, and GCP deployment if account permissions block it. Preserve visible WASD multiplayer, AI talk, and measurable change of route.
