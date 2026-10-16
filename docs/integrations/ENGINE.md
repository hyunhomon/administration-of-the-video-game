# RPG engine dependency spike

## Preferred candidate
RPGJS is a candidate, **not a locked dependency**. Validate exact stable distribution, package names, engine license, web export, server multiplayer sync, NPC control programmatic API, and compatibility with Bun/Node. Don't treat marketing feature lists as proof of an integration path.

## 90-minute spike checklist
1. Create a clean example game from current official docs.
2. Run browser locally; move 1 player on tilemap.
3. Connect 2 browser windows to a shared room.
4. Spawn scripted NPC and command its movement through server code.
5. Interact/chat with NPC; hook custom event into game state.
6. Inspect license of code, tilesets, sprite sheets and demo content separately.
7. Record commands, repository revision and issues in ADR-001.

## Decision rule
If custom AI-controlled movement or multiplayer authority is difficult, switch to Phaser for rendering + a tiny Bun WebSocket room server. Do not spend the entire hackathon fighting engine integration.

## References
- RPGJS https://rpgjs.dev/
- RPGJS source https://github.com/RSamaium/RPG-JS
- Phaser https://phaser.io/
