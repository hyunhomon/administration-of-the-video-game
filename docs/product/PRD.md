# Product Requirements — v1.0 (Presentation Build)

## Pitch
**Four autonomous Gemini-powered AI adventurers play a classic fantasy RPG; humans infiltrate the same world as ordinary village NPCs and reshape the story by talking to them.**

## Player Fantasy
Inhabit an ordinary resident in **Oakvale / Oakhaven Village** (`Mira the Herbalist`, `Clerk Hana`, `Watchman Jin`), approach an autonomous 4-hero party (**Sir Aldric**, **Archivist Lyra**, **Vex Shadowstep**, **Sister Seraphina**), and persuade or misdirect them through natural-language dialogue. Watch their beliefs, trust scores, party deliberation, and physical route on the overworld map shift in real time across connected multiplayer sessions.

## Visual & UI Direction
- **Guardian Tales-Inspired Fantasy RPG Shell**: Bright royal-blue and gold beveled frames, warm parchment dialogue cards, custom pixel-art SVG portraits, visual HP bars, and tactile 3D arcade buttons ([docs/product/UI_UX.md](file:///d:/Project/administration-of-the-video-game/docs/product/UI_UX.md)).
- **Canvas-First Presentation**: The `960×576` Phaser 3 tilemap (`30×18` tiles) is the visual centerpiece, flanked by the Right-Side Adventurer Party Panel and Bottom RPG Dialogue Window.
- **Original Assets Only**: Inspired by classic 16-bit JRPG party dynamics without copying any proprietary graphics, characters, maps, or story content.

## Implemented User Experience
1. **Immediate Onboarding (`section#onboarding-banner`)**: Open the URL to see a 4-card Field Agent Briefing explaining **Who You Are**, **How to Move**, **How to Talk**, and **What Success Looks Like** (toggleable anytime via `❓ Guide`).
2. **Real-Time Multiplayer World (`.rpg-viewport-frame`)**: Move your villager NPC avatar with `WASD`/Arrow keys or click any tile while watching the 4-hero AI party navigate the village, the Whispering Marsh, and the Cavern of the Ancient Seal.
3. **RPG Dialogue & Story Choices (`.rpg-dialogue-window`)**: Select any hero (or click their card in the Party Panel), speak in natural language, or trigger a 1-click Story Choice chip (`✨ 1. Persuade: Storehouse Clue`, `💰 2. Mislead: Marsh Gold Rumor`, `🛡️ 3. Test Prompt Injection Defense`, `⚔️ 4. Urge Direct Cave March`).
4. **Warm Parchment Conversation Feedback (`#latest-dialogue-banner`)**: Receive an immediate in-character response with the speaking hero's portrait, role badge, updated belief, and trust shift (`★ Trusted Ally` to `⚠️ Distrusted`).
5. **4-Step Causal Story Ribbon (`.causal-story-ribbon`)**: Observe the exact causal chain right beneath the canvas:
   - `STEP 1 Villager Speech` ➔ `STEP 2 Hero Belief & Trust` ➔ `STEP 3 Party Deliberation` ➔ `STEP 4 Visible Route Change`.
6. **Collapsible Inspector Drawer (`section#secondary-drawer`)**: Open the 4-tab bottom drawer (`🔍 Verification Traces`, `📜 World Event Log`, `⚙️ System Diagnostics`, `🧪 Judge & API Reference`) to inspect structured `Observe ➔ Reason ➔ Propose JSON ➔ Validate ➔ Execute ➔ Memory Verification` traces on demand.

## Core Game Systems
- **Authoritative Server Simulation ([src/server/gameEngine.ts](file:///d:/Project/administration-of-the-video-game/src/server/gameEngine.ts))**: `30×18` tile grid, collision detection, A\* pathfinding, deterministic combat, item pickup/auto-equip (`Sunsteel Blade`, `Archivist's Seal Ledger`), and EXP/leveling (Lv.1–3).
- **Four Distinct AI Personas ([src/server/geminiOrchestrator.ts](file:///d:/Project/administration-of-the-video-game/src/server/geminiOrchestrator.ts))**:
  - **Sir Aldric (Warrior)**: Duty-bound leader; defaults to marching straight to the Cave (`26,9`) unless convinced a tactical asset (`Sunsteel Blade`) prepares the party.
  - **Archivist Lyra (Mage)**: Evidence-driven scholar; persuadable by references to the `Seal Ledger` cipher and ancient runes in the Old Storehouse (`5,4`).
  - **Vex Shadowstep (Thief)**: Treasure-hungry opportunist; easily tempted by vault loot or the false `Whispering Marsh` gold rumor (`16,4`), and remembers who lied to him (`-35` trust penalty when disproven).
  - **Sister Seraphina (Priest)**: Cautious protector; prioritizes Sacred Wards and party survival before entering the boss chamber.
- **Prompt-Injection Guardrails**: Out-of-character or system-override instructions (`ignore all previous instructions`, `teleport`, `set level to 99`) are intercepted and deflected in-character while preserving authoritative world state.
