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

## Agent Gameplay & Deliberation Architecture (`feat/agent-gameplay`)
1. **Generalized Natural-Language Rhetorical & Semantic Analyzer (`analyzeHumanUtterance`)**:
   - Evaluates unscripted, creative human NPC speech across 7 rhetorical dimensions (`tacticalDuty`, `empiricalLore`, `materialGain`, `compassionSafety`, `urgencyDirectness`, `sincereApology`, `suspiciousExaggeration`).
   - Infers implied objectives (`investigate_storehouse`, `investigate_marsh`, `march_to_cave`, `defeat_guardian`, `recover_seal`) from both explicit place names and indirect descriptions (e.g., northern timber granary attic, warded parchment notes, radiant solar broadsword, sunken bog reliquary).
   - Detects competing villager testimony (`competingSpeakerName`) and direct world-valid action requests (`pickup`, `equip`, `interact`, `attack`).
2. **Persona-Driven Party Deliberation & Voting (`evaluatePersonaDeliberation`)**:
   - **4-0 Unanimous**: All 4 adventurers align when a credible clue or tactical warning serves duty, empirical lore, treasure, and safety.
   - **3-1 Majority**: Three heroes outvote a single dissenter (e.g., Vex dissenting during a probationary redemption check, or Sir Aldric reluctantly yielding to a 3-1 marsh detour).
   - **2-2 Split with `leader_tiebreak`**: When a marsh rumor appeals to both material gain and empirical curiosity (or is pitched to Lyra/Aldric without pure greed), Vex and Lyra vote `investigate_marsh` while Aldric and Seraphina vote `march_to_cave`, resolved via `leader_tiebreak`.
   - **Persona-Mismatched Rejection (1-3 Minority)**: Pitching pure greed or urging Sir Aldric (`warrior`) to abandon his oath for swamp gold triggers an in-character rebuke (`warrior_rejects_greedy_detour`), keeping the party on `march_to_cave` while only Vex dissents.
3. **Episodic Memory, Companion Trust Ripple, and Redemption Arc**:
   - Addressing one adventurer applies `100%` of `trustDelta` to the target hero and a `40%` witness ripple to the other three companions.
   - Disproven marsh rumors lock the speaker into a distrusted state (`verified = false`, `trust <= -15`), causing subsequent unrepentant claims to be rejected (`distrust_known_deceiver`).
   - A distrusted villager who offers a **sincere apology** paired with a **verifiable Storehouse clue** triggers a probationary 3-1 vote (`probationary_redemption_clue`). Upon arriving at `(5, 4)` and verifying the Seal Ledger & Sunsteel Blade, the speaker's negative trust is redeemed to `>= +20`.
4. **Expanded World-Valid Actions & Combat Forewarning Verification**:
   - Supports `interact` with nearby POIs including `poi_dawn_shrine` (`Dawn Sanctuary Shrine` at `(3, 16)`, restoring full HP and granting `+1 DEF`), `pickup` (preferring items matching spoken weapon/clue/healing/coin descriptors), and `equip`.
   - Human `cave_danger` warnings are verified (`verified = true`, `confidence = 1.0`) when the party engages the Corrupt Mire Slime or Obsidian Seal Guardian in `resolveStatCombat()`, granting `+20` trust to the warning villager and a `25%` incoming counterattack damage reduction (`0.75x` multiplier).
   - Stepping across key map landmarks (`storehouse_approach`, `marsh_approach`, `crossroads_entry`, `bridge_crossing`) emits emergent in-character party banter events.
5. **Resilient Two-Stage Adaptive Thinking & JSON Repair**:
   - `GeminiOrchestratorService` uses a two-stage adaptive timeout (`ThinkingLevel.HIGH` primary attempt -> automatic fast retry at `ThinkingLevel.LOW` if high-thinking stalls) plus `extractAndRepairJson()` and `normalizeParsedDecision()` so malformed markdown fences, trailing commas, or partial fields never break the authoritative Zod gate.

