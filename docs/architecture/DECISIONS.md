# Architecture decisions

## ADR-000: Documentation-first skeleton
- Status: accepted
- Reason: prioritize agent-runtime development and fast repo scaffolding while avoiding unverified package commands.
- Consequences: this ZIP does not include a runnable engine or vendored assets.

## ADR-001: RPG engine selection
- Status: pending validation
- Candidate: RPGJS; fallback Phaser + small server.
- Verify: runtime, multiplayer, client/server extensibility, collision/movement, build pipeline, license, and examples before commit.

## ADR-002: AI provider
- Status: accepted as design direction
- Google AI Studio API via `@google/genai` from server only. Model names discovered/validated at setup time; no unsupported ID baked into code.

## ADR-003: IP policy
- Status: accepted
- Dragon Quest is inspiration only; no proprietary assets or ROM-based redistribution.


## Repository initialization
- Project Korean public name: **전자오락관리국**. Code identifier: `administration-of-the-video-game`. All versioned deliverables start at `0.0.0`; scaffolding is intentionally left to Antigravity.
- GCP deployment target: Cloud Run, single demo instance while using in-memory rooms.
- Antigravity coding selection: Gemini 4 Argon / High, if selectable; not an API model ID.
