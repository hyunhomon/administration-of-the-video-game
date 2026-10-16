# Gameplay & rules — v0.0

## Movement and actions
WASD/arrows move on a discrete tile grid. E interacts with adjacent actor/object. Chat input opens when near a speaking target; allow non-blocking chat for other humans. Agents use the same move, interact, pickup, equip, and talk action API as human avatars when applicable.

## Party
Warrior (duty, combat), mage (evidence, curiosity), thief (loot, opportunism), priest (compassion, caution). Distinct knowledge, memories, trust values and personal goals. They may disagree; team movement follows an explicit party decision, not an average of raw messages. Party formation visually follows leader while each mind stays distinct.

## Advancement
EXP from encounters/events; levels 1–3; HP/attack/defense/intelligence/speed. Gear modifies derived stats. Combat produces an event log through server-only seeded resolution. Avoid combat as a user skill challenge; focus is social intervention.

## Dialogue loop
Human enters text → proximity check and throttling → persona receives bounded scene context → returns speech plus optional belief proposal → validation → world ledger update → later decision takes new belief into account. Player statements become **claims**, not authoritative facts. NPCs can doubt, ask for proof, investigate, or remember deception.

## Story state
Flags: `sealQuestKnown`, `storehouseInvestigated`, `caveVisited`, `sealRecovered`, `rumorSuspected`, `questComplete`. Branch A: direct cave. Branch B: investigate storehouse then cave. An intentionally false rumor can produce a short detour but cannot hard-lock quest.

## Multiplayer design
Humans occupy persistent in-room avatars and have names/nicknames. Voice radio and disguise mechanics are *post-MVP*. Same coordinate/quest state to every player via authoritative server. Human clients never directly mutate AI beliefs or quest flags.

## Fail safe
If model stalls, local NPC barks, navigation and exploration still function. No unbounded waits, no endless discussions. Agent output must match available actions and reachable coordinates.
