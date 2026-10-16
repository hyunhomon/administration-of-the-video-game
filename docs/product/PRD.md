# Product requirements — v0.0

## Pitch
**Four AI adventurers play a classic RPG; humans infiltrate the same world as NPCs and change the story by talking to them.**

## Player fantasy
Be an apparently ordinary resident in a living JRPG world, persuade or mislead autonomous adventurers, then watch whether their actions genuinely change. Multiplayer humans can collaborate or compete to influence the party.

## Inspiration boundaries
Reference early Dragon Quest III for 4-person party, archetypal classes, exploration, leveling, equipment, towns, overworld, dungeon, and dialogue. Build an independent original story, names, look, maps, and assets.

## MVP user experience
1. Open a URL; join room as a human NPC and move with WASD/arrow keys.
2. Observe four AI adventurers moving in a tile-based top-down world (shared realtime state).
3. Approach one member, press E, enter natural-language dialogue (text required; voice optional).
4. Receive a persona-consistent response; agent belief/trust/memory is changed based on evidence and personality.
5. At next meaningful decision, party deliberates, chooses a destination, and physically walks to it.
6. UI highlights the **cause** of branch change: conversation → revised belief → chosen goal → actual location.

## MVP game systems
- Tile grid and collision, pathfinding and deterministic movement.
- Zone map: village, path/field, small cave (can be on 1–3 tilemaps).
- 4 classes: warrior, mage, thief, priest. Distinct stats and incentives, not complex skill trees.
- Items: coin, healing item, weapon upgrade, clue. Inventory/equipment and EXP/levels 1–3.
- Combat is automatic: compare stats + bounded RNG with seeded combat log; no dedicated battle screen.
- NPC talk, quest flags, optional branch outcome; one principal quest with two plausible approaches.
- Multiplayer: target 2 human NPC users, extensible to 4; chat + avatar controls.
- Observability: compact party timeline, current goals, public explanations; do not expose private chain-of-thought.

## World seed
An adventurer party must retrieve an ancient seal from a cave. Human NPCs may persuade them to visit a storehouse first (real clue) or misdirect toward a dead end (false rumor). Trust changes based on evidence, and each persona weighs claims differently. No direct chat command can teleport, spawn items, or fabricate world facts.

## Out of scope
Full 30h campaign, real Dragon Quest content, player-vs-player combat, crafting, deep economy, procedural 3D, freeform code generation at runtime, MMO scale, continuous token-per-frame reasoning, voice-first controls.

## Demo success
A 5–8 minute guided demonstration reveals distinct agent reactions and a visibly changed route caused by a human player's conversational intervention.
