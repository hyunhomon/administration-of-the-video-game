# Administration of the Video Game

**Korean title:** 전자오락관리국

> Four autonomous AI adventurers play a classic pixel-art RPG while human players enter the same world as controllable NPCs, using natural-language dialogue to influence the party.

**Hackathon track:** Gemini 4 Argon in entertainment (Track 1). See [judging alignment](docs/product/JUDGING.md).

**Status:** documentation-only repository, version `0.0.0`. **No game scaffold is committed.**

## Quick start

1. Extract this archive into a new Git repository.
2. `git init && git add . && git commit -m "chore: initialize administration-of-the-video-game"`
3. Connect repository in Google Antigravity and choose **Gemini 4 Argon / High** in the IDE if available. This is an **IDE setting**, not a tracked repository configuration.
4. Paste the instructions from [`START_ANTIGRAVITY.md`](START_ANTIGRAVITY.md).
5. Add Google AI Studio credentials to an untracked `.env` **after** scaffolding. Never commit secrets.

## Repository map

- [`AGENTS.md`](AGENTS.md) — instructions for the coding agent
- [`START_ANTIGRAVITY.md`](START_ANTIGRAVITY.md) — paste-ready development prompt
- [`docs/product/`](docs/product/) — project definition, mechanics, demo
- [`docs/architecture/`](docs/architecture/) — architecture and tool/state contracts
- [`docs/agents/`](docs/agents/) — NPC minds, coordination, prompts, evaluation
- [`docs/integrations/`](docs/integrations/) — RPG engine and Google AI Studio integration
- [`docs/assets/`](docs/assets/) — open assets and Nano Banana pipeline
- [`docs/deployment/`](docs/deployment/) — GCP Cloud Run deployment plan
- [`docs/delivery/`](docs/delivery/) — 3-hour priority schedule, acceptance checklist
- [`config/.env.example`](config/.env.example) — server-only variable reference

## Non-negotiables

Browser playable. Shared human NPC movement and typed chat. Four distinct AI adventurer identities (scripted fallback allowed). Player dialogue visibly changes party belief and route. Server-authoritative deterministic movement/loot/level/combat. No Dragon Quest assets/code. Google AI Studio key is server-side. For deployment use **Google Cloud Run**, keeping demo compatible with a single instance when using in-memory multiplayer state.

Read `docs/delivery/ACCEPTANCE.md` before considering MVP complete.
