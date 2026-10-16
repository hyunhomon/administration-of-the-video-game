# MVP acceptance criteria — objective checks

- [ ] Fresh-clone documented install and run commands work.
- [ ] Browser renders original/licensed top-down map and controllable human NPC via WASD; collision works.
- [ ] Two distinct browser tabs join one room and observe each other's position and chat.
- [ ] Four visible AI adventurers have separate class/persona/belief/memory state (even if movement is grouped).
- [ ] Party has a goal, moves, picks up a sample item, gains XP/level and resolves a stat-only combat event.
- [ ] Human avatar addresses an adventurer in natural language; AI responds in role.
- [ ] Human misinformation or persuasion causes a **logged and visually obvious** change in party goal/route when plausible. Alternate response is deterministic under offline fallback.
- [ ] Structured model intents are validated server-side; malicious instruction-like chat cannot invoke system tools.
- [ ] AI timeouts, rate/cost caps and offline fallback keep demo usable.
- [ ] No game secrets shipped in browser or committed.
- [ ] License attribution and no unauthorized game IP included.
- [ ] Production build passes and Cloud Run deployment instructions exist; live URL only if truly deployed and tested.
- [ ] `STATUS.md` truthfully reports completed, blocked, manual configuration needed and exact test commands.
