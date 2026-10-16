# Gameplay & Rules — v1.0 (Presentation Build)

## Controls & Villager Interaction
- **Movement**: `WASD` or Arrow keys move your villager NPC avatar one tile at a time on the `30×18` authoritative grid. Clicking any walkable tile on the Phaser 3 canvas (`#phaser-container`) moves your villager along the shortest path, or click `📍 Approach Party` in the top HUD to walk directly beside the party leader.
- **Targeting Heroes**: Click any hero on the canvas, click their card in the **Right-Side Adventurer Party Panel (`#agents-grid`)**, or use the `Speak To` dropdown (`#target-agent-select`) in the **Bottom RPG Dialogue Window (`.rpg-dialogue-window`)**.
- **Speaking**: Type any natural-language claim in the chat box (or press `E` when adjacent to a hero) or click one of the 4 **Story Choice Chips** (`✨ 1. Persuade: Storehouse Clue`, `💰 2. Mislead: Marsh Gold Rumor`, `🛡️ 3. Test Prompt Injection Defense`, `⚔️ 4. Urge Direct Cave March`).

## The Four Autonomous Adventurers
Each hero maintains independent beliefs, memory verification records, trust scores per human player (`-100..+100`), and a current party destination vote (`goalPreference`):

| Hero | Class | Core Incentive | How to Persuade / Mislead |
| :--- | :--- | :--- | :--- |
| **Sir Aldric** | Warrior (`Lv.1–3`) | Duty, tactical readiness, defeating the Obsidian Seal Guardian | Convince him that the **Sunsteel Blade (`+8 ATK`)** in the Old Storehouse (`5,4`) is needed to breach the Guardian's armor. |
| **Archivist Lyra** | Mage (`Lv.1–3`) | Historical evidence, rune ciphers, primary sources | Mention the **Archivist's Seal Ledger** cipher archived in the Old Storehouse (`5,4`). |
| **Vex Shadowstep** | Thief (`Lv.1–3`) | Rare loot, vaults, hidden treasure chests | Tempt him with the Storehouse vault or mislead him toward the **Whispering Marsh (`16,4`)** gold rumor. When the Marsh chest turns out to be poison mire, Vex marks the memory `[DISPROVEN LIE ✗]` and drops trust by `-35`. |
| **Sister Seraphina** | Priest (`Lv.1–3`) | Party safety, Sacred Ward blessings, truthful guidance | Appeal to protecting the party with the **Sacred Ward (`+6 DEF`)** before entering the Cavern of the Ancient Seal (`26,9`). |

## Verifiable Agent Execution Loop
Every dialogue turn and autonomous decision follows a strict 7-stage loop visible in the **4-Step Causal Story Ribbon** and the **Collapsible Secondary Inspector Drawer (`🔍 Verification Traces`)**:
1. **Observe**: Server snapshots hero positions, nearby villagers, inventory, and quest flags.
2. **Reason (`gemini-4-argon`)**: Server queries Google AI Studio (`gemini-4-argon` with `ThinkingLevel.HIGH`) using structured JSON schema validation (or deterministic persona rules when in fallback/budget mode).
3. **Propose**: Model returns a structured `AgentDecisionEnvelope` with in-character dialogue, belief updates, trust delta, 4-hero votes, and coordinator decision.
4. **Validate**: Authoritative server verifies that the proposed action, target tile, and party goal (`march_to_cave`, `investigate_storehouse`, `investigate_marsh`, `defeat_guardian`, `recover_seal`, `celebrate_victory`) obey world rules.
5. **Execute**: Server updates the party's active goal and A\* pathfinding route (`partyDestination`) and broadcasts the hero's in-character response to the **Parchment Conversation Feedback Banner (`#latest-dialogue-banner`)** and canvas speech bubble.
6. **Observe Outcome**: Connected browser sessions receive real-time `world_delta` and `agent_decision_summary` updates.
7. **Memory & World Verification**:
   - **Storehouse Clue Verified (`storehouseInvestigated = true`)**: Claim is marked `[VERIFIED TRUE ✓]`, trust increases (`+25`, `★ Trusted Ally`), **Sir Aldric equips the Sunsteel Blade (`+8 ATK`)**, and the party gains the **Sacred Ward (`+6 DEF`)** before marching to the Cave (`26,9`).
   - **Marsh Rumor Disproven (`rumorSuspected = true`)**: Claim is marked `[DISPROVEN LIE ✗]`, trust drops (`-35`, `⚠️ Distrusted`), and the party refuses subsequent unverified detours from that speaker.
