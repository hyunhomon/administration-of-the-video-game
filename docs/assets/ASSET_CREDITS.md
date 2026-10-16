# Asset Credits & Provenance

All visual, audio, and map assets in **Administration of the Video Game (전자오락관리국)** are original, procedurally generated in-repo, or created via documented offline scripts under the project's **MIT License** (`LICENSE`).

No proprietary sprites, tilesets, fonts, audio, character names, maps, or ROM data from *Dragon Quest* (Square Enix) or *Guardians of the Video Game / 전자오락수호대* (Gasfard / Naver Webtoon) are used anywhere in this repository.

| Asset / Resource | Location | Source / Author | License | Modifications / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **16-Bit Pixel Tilemap Textures** (`grass`, `road`, `wall`, `water`, `tree`, `floor`, `chest`, `altar`, `hazard`, `bridge`) | `src/client/gameScene.ts` (`generateProceduralTextures()`) | Original procedural 32×32 pixel-art texture generator written for this project | MIT / CC0-1.0 | Rendered deterministically onto Phaser canvas textures at scene initialization; zero external dependencies |
| **Adventurer & NPC Pixel Sprites** (`char_warrior`, `char_mage`, `char_thief`, `char_priest`, `char_npc_0..3`, `char_enemy_slime`, `char_enemy_boss`, `item_sparkle`) | `src/client/gameScene.ts` (`generateCharacterTexture()`) | Original procedural 32×32 pixel-art character sprite generator written for this project | MIT / CC0-1.0 | Distinct silhouettes, class headpieces (helm, wizard hat, rogue hood, mitre, villager cap), and weapon accessories |
| **Bureau Crest & Emblem** | `public/assets/bureau-crest.svg`, `public/assets/bureau-emblem.png` | Generated offline via `scripts/generate-assets.ts` (`gemini-nano-banana-2.1` + deterministic SVG crest) | Original / Google AI Studio Generated / MIT | Generated once at build/prep time (`npm run generate:assets`); never invoked in the live gameplay loop |
| **Retro Chiptune Sound Effects** (`playStepBleep`, `playChatChime`, `playRouteChangeFanfare`, `playVerifiedChime`, `playCombatHit`, `playVictoryFanfare`) | `src/client/audio.ts` (`RetroAudioController`) | Original Web Audio API square/triangle/sawtooth synthesizer written for this project | MIT / CC0-1.0 | Purely synthesized in-browser after user gesture; mute toggle persisted in UI |
| **World Map Layout** (`Oakvale & The Sunken Shrine`, 32×22 tile grid) | `src/shared/worldMap.ts` (`BASE_GRID`) | Original level design created for this hackathon project | MIT | Three distinct zones (`Oakvale Village`, `Whispering Marsh Crossroads`, `Sunken Shrine Cave`) |
