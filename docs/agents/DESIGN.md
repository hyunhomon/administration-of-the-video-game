# Agent architecture — v0.0

## Four separate minds, one shared world
Each adventurer owns persona, goal, limited knowledge, trust table and episodic memory. The party coordinator reads their *declared preferences* and current quest constraints to produce one actionable group objective. Do not collapse four into a single RP prompt.

## Reasoning steps
1. World event creates a decision trigger.
2. Build constrained observation for the affected actor only (position, nearby characters, evidence, relevant memories).
3. Use model to produce schema-validated `speech`, `beliefUpdates?`, `proposedIntent?`, `goalPreference?`.
4. Gate updates (claims ≠ facts; evidence from authoritative world can verify).
5. If collective decision required, request short choices from members, then resolve with coordinator based on quests and personality.
6. Apply validated intent, log consequences, stream concise decision summary.

## Memory
Store normalized claims with source, timestamp and confidence. Separate verifiable world facts from statements by humans. Use top-K retrieval for relevant memories; do not pump full transcript into every turn. Repeated lies diminish source trust when disproven. Trust ranges -100..100 and changes within bounded deltas.

## Personality differentiation
- Warrior: loyalty and completing quest; resists unexplained detours.
- Mage: seeks evidence and lore, often proposes investigation.
- Thief: tracks loot/value and tolerates opportunistic deviations.
- Priest: prioritizes safety and people; objects to avoidable harm.

## Scheduling
Single agent decision when directly addressed; group decision only for meaningful forks. Use cooldowns, a maximum of one high-level action per actor per decision cycle, and no action bursts. Cache short responses for benign repeated situations.

## Failure modes
Model invalid JSON → bounded retry → default safe intent. Conflicting beliefs → bounded party discussion → deterministic tie-break. Provider offline → scripted personas and one known path clearly marked demo fallback. Prevent prompt injection disguised as NPC dialogue.
