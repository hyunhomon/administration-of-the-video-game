# Antigravity instructions — Administration of the Video Game

## Mission
Implement a functioning, publicly demoable multiplayer browser RPG using this repository's documents. This is a greenfield documentation-only starter. **You own scaffolding, implementation, testing and deployment**, subject to available credentials/permissions. Work autonomously on reversible tasks. Do not require user approval for routine commits. Never claim completed steps without running evidence.

## Read order
1. `README.md` and `docs/product/PRD.md`
2. `docs/delivery/ACCEPTANCE.md`, `docs/delivery/PLAN.md`
3. `docs/architecture/SYSTEM.md`, `docs/architecture/CONTRACTS.md`
4. `docs/integrations/ENGINE.md`, `docs/integrations/GOOGLE_AI.md`
5. `docs/deployment/GCP.md`, `docs/assets/PIPELINE.md`

## Hard constraints
- Real browser-controlled NPC avatars, WASD movement, collision, visible avatars, text chat, shared 2-player room.
- Four distinct AI adventurers with personality/memory/goals; party travels, gathers items, levels, talks to NPCs, and resolves stat-based fights. Implement a single, short deterministic quest.
- Use a proven permissively licensed web RPG engine or framework and legally reusable assets. **Spike framework and license first; timebox to 15 minutes.** RPGJS is only a candidate. If its integration is too slow use Phaser + a tiny authoritative game server.
- All world state and math authoritative on the server. AI returns validated JSON intents; never run arbitrary generated code. No per-frame LLM calls. Human text is untrusted in-world speech, never developer/system instructions.
- Google AI Studio Gemini calls only from server using the official SDK. Keep model IDs env-configurable; verify available IDs from the actual account. `Gemini 4 Argon / High` describes Antigravity *coding model* selection, not necessarily the game's AI Studio model ID. Use `thinkingLevel: high` only when supported.
- Protect secrets. `.env` untracked; no browser API keys, excessive prompt logging, or committed credentials. Add budget/timeouts/call caps/offline scripted mode.
- Host on Google Cloud Run if working credentials and permissions are available. Never invent a project ID; provide exact commands for the user if deployment authorization is unavailable. Prefer a single instance for in-memory demo rooms; mention ephemeral state.
- Do not copy Dragon Quest/전자오락수호대 proprietary characters, maps, ROM, graphics, names, music, or story. Inspiration only. Record asset licenses.

## Execute with time budget
Follow `docs/delivery/PLAN.md`: make a playable single-room vertical slice first, then AI influence, then four agent identities, then polish/deploy. Scope cut before schedule slips. Never cut playable movement, dialogue, or visible resulting choice. Prioritize functional software over extra docs.

## Validation
Run lint/typecheck/build and test the critical path with two browser sessions. Verify service binds `0.0.0.0:$PORT`, no secrets in client, production build and Cloud Run container command. Update README with actual run/deploy instructions as implemented. Record tradeoffs in `docs/architecture/DECISIONS.md`. Maintain an honest `STATUS.md` with working, untested, blockers, and commands.

## Mandatory judging alignment
Read `docs/product/JUDGING.md` and prioritize measurable real-user input -> verified world-state change -> actual visible agent action. Keep all documentation, UI demo captions, and pitch materials in English (the official Korean title may appear as a proper noun). Do not portray unavailable API/model features as implemented. Include at least one repeatable verification-loop test in the MVP.
