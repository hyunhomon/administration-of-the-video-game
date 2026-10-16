# AI Gameplay & Agent Systems Progress (`feat/agent-gameplay`)

## Branch & Worktree Isolation
- **Branch**: `feat/agent-gameplay` (created from `main` at `95061da`)
- **Worktree**: `.worktrees/feat-agent-gameplay`
- **Scope & Boundaries**:
  - Exclusively focused on `src/server/`, agent deliberation, natural-language persuasion analysis, world verification rules, and unit/integration test coverage.
  - Zero modifications to `src/client/`, `index.html`, UI styling, or the shared `STATUS.md`.
  - 100% wire and schema compatibility preserved with `src/shared/contracts.ts`.

---

## Milestones & Recorded Commits

### Milestone 1 — Baseline UI/UX & Documentation Commit on `main` (`95061da`)
- **Commit**: `95061da` (`docs: complete UI/UX documentation refresh and update STATUS.md`)
- **Behavior**: Completed and committed all prior workspace changes on `main` before creating the isolated `.worktrees/feat-agent-gameplay` worktree.

### Milestone 2 — Generalized NL Persuasion, Persona Deliberation, Trust Redemption & World Verification (`9cd3e72`)
- **Commit**: `9cd3e72` (`feat(agent-gameplay): generalize NL persuasion, persona deliberation, trust redemption, and combat verification`)
- **Files Modified / Added**:
  - `src/server/geminiService.ts`
  - `src/server/gameEngine.ts`
  - `tests/unit/agentGameplay.test.ts`

#### Implemented Behavior
1. **Generalized Natural-Language Persuasion (`analyzeHumanUtterance`)**:
   - Replaced rigid keyword matching with a 7-dimension rhetorical analyzer scoring:
     - `tacticalDuty` (oaths, formations, radiant/sunsteel weaponry, shields, ambushes, boss weaknesses)
     - `empiricalLore` (archives, chroniclers, ciphers, runes, warded parchment notes, primary sources)
     - `materialGain` (gold coins, sunken reliquaries, caches, gemstones, bounties)
     - `compassionSafety` (Dawn blessings, shrines, warding curses, protecting villagers)
     - `urgencyDirectness` (immediate action, avoiding distractions, direct assault)
     - `sincereApology` (remorse, admitting prior deception, offering verifiable penance)
     - `suspiciousExaggeration` (hyperbolic promises, urging heroes to abandon their oath)
   - Infers implied party goals (`investigate_storehouse`, `investigate_marsh`, `march_to_cave`) from indirect descriptions even when no template place names (`Old Storehouse`, `Seal Ledger`, `Sunsteel Blade`) are used.
   - Detects competing villager claims (`competingSpeakerName`) when multiple human players try to steer the party in different directions.
   - Extracts immediate, world-valid tactical intents (`pickup`, `equip`, `interact`, `attack`) from natural dialogue, including matching item descriptors (`weapon`, `clue`, `healing`, `coin`) when multiple items are within reach.

2. **Deepened Adventurer Personalities, Disagreement & Voting (`evaluatePersonaDeliberation`)**:
   - **4-0 Unanimous Consensus**: Triggered when a credible clue or tactical warning aligns with duty, scholarship, loot, and party safety.
   - **3-1 Majority Vote**: Three heroes outvote a single dissenter (e.g., Vex dissenting during a probationary redemption test, or Sir Aldric reluctantly yielding 5 minutes to a 3-1 marsh check).
   - **2-2 Split Vote (`leader_tiebreak`)**: Triggered when a marsh pitch combines material gain and empirical curiosity (or is pitched to Lyra/Aldric without pure greed), splitting `(thief, mage)` for `investigate_marsh` vs `(warrior, priest)` for `march_to_cave`, resolved via `leader_tiebreak`.
   - **1-3 Persona-Mismatched Rejection (`warrior_rejects_greedy_detour`)**: Pitching pure swamp greed or telling Sir Aldric (`warrior`) to forget his oath causes him, Lyra, and Seraphina to reject the detour (`3-1` keeping `march_to_cave` while only Vex dissents) and penalizes speaker trust.

3. **Episodic Memory, Companion Trust Ripple & Probationary Trust Redemption**:
   - **Companion Witness Ripple**: Addressing one adventurer applies `100%` of `trustDelta` to the addressed hero and a `40%` witness ripple to the other three party members.
   - **Deception -> Distrust Lock -> Probationary Redemption -> World Verification**:
     - Luring the party to the empty Whispering Marsh decoy chest marks `marsh_rumor` memories `verified = false` and drops trust below `-15`.
     - Subsequent unrepentant claims from the deceiver are rejected (`distrust_known_deceiver`).
     - If the distrusted speaker sincerely apologizes and provides a verifiable clue about the Old Storehouse (`probationary_redemption_clue`), Seraphina, Lyra, and Aldric vote `3-1` to grant a probationary check.
     - Upon reaching `(5, 4)` and verifying the Storehouse clue in the world, the speaker's negative trust is redeemed to `>= +20`.

4. **Expanded World-Valid Agent Actions, Combat Warning Verification & Emergent Banter**:
   - **Dawn Sanctuary Shrine (`poi_dawn_shrine` at `(3, 16)`)**: Human players can ask the party to pray at or inspect the village shrine (`interact` intent), restoring all 4 heroes to full `maxHp` and granting `+1 DEF`.
   - **Combat Forewarning Verification (`resolveStatCombat`)**: Human `cave_danger` warnings about the Corrupt Mire Slime or Obsidian Seal Guardian are verified (`verified = true`, `confidence = 1.0`) when combat begins, boosting all 4 heroes' trust in the warning villager by `+20` and reducing enemy counterattack damage by `25%` (`0.75x` multiplier).
   - **Milestone Travel Banter (`checkTravelBanterMilestones`)**: As the party traverses key landmarks (`storehouse_approach`, `marsh_approach`, `crossroads_entry`, `bridge_crossing`), companions exchange contextual in-character banter in `visibleEvents`.
   - **Memory- & Trust-Aware Proximity Greetings (`handleHumanInteract`)**: Pressing `E` near an adventurer produces dynamic responses reflecting whether the villager has verified clues, disproven rumors, or neutral standing.

5. **Resilient Live `gemini-4-argon` Latency & JSON Repair**:
   - Added a two-stage adaptive thinking timeout in `GeminiOrchestratorService` (`11.5s` primary attempt at `ThinkingLevel.HIGH` -> automatic fast retry at `ThinkingLevel.LOW` before falling back to deterministic persona deliberation).
   - Added `extractAndRepairJson()` and `normalizeParsedDecision()` to strip markdown fences, repair trailing commas, and backfill any missing fields while preserving strict `AgentDecisionEnvelopeSchema` validation.

---

## Verification & Test Results

Executed inside `.worktrees/feat-agent-gameplay`:

```bash
npm run typecheck
npm run build
npm test
```

- **`npm run typecheck`**: Passed (`0` errors).
- **`npm run build`**: Passed (`dist/client` and `dist/server` built cleanly).
- **`npm test`**: **3 passed test suites (19/19 tests passing)**:
  1. `tests/unit/agentGameplay.test.ts` (9/9 passed):
     - Multi-dimensional rhetorical persuasion without predefined template keywords + companion trust ripple
     - Persona-specific skepticism (`warrior` rejects greedy marsh detour `3-1` while `thief` dissents)
     - Authentic `2-2` split party deliberation resolved via `leader_tiebreak`
     - Full Deception -> Distrust Lock -> Probationary Redemption -> World Verification trust recovery arc
     - Multi-villager competing claims (Player 2 counter-persuades party away from Player 1's marsh detour)
     - Tactical danger warning (`cave_danger`) combat verification (`+20` trust and `-25%` enemy counterattack damage)
     - Expanded world-valid actions (`poi_dawn_shrine` consecration via `interact`, plus `pickup` and `equip` via dialogue)
     - Malformed LLM JSON wrapper repair (`extractAndRepairJson`) and emergent travel banter milestones
     - Trust- and memory-aware proximity `interact` greetings
  2. `tests/unit/verificationLoop.test.ts` (7/7 passed, including live `gemini-4-argon` API verification)
  3. `tests/unit/multiplayerAndBundle.test.ts` (3/3 passed, including 2-session WebSocket synchronization and zero client secret leakage)

---

## Known Limitations
- In-memory room state remains single-instance by design (`ADR-004`); room state resets on server restart or `reset` control command.
- Live `gemini-4-argon` latency under `ThinkingLevel.HIGH` varies between `4s` and `19s` depending on Google AI Studio load; the two-stage adaptive thinking retry (`HIGH` -> `LOW`) and deterministic persona fallback ensure gameplay never blocks beyond the bounded timeout.
