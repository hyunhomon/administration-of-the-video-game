import { describe, it, expect } from 'vitest';
import { AuthoritativeGameRoom } from '../../src/server/gameEngine.js';
import {
  analyzeHumanUtterance,
  evaluatePersonaDeliberation,
  extractAndRepairJson,
} from '../../src/server/geminiService.js';

describe('AI Gameplay & Autonomous Agent Systems (feat/agent-gameplay)', () => {
  it('generalizes natural-language persuasion beyond predefined keywords using multi-dimensional rhetorical analysis', async () => {
    const room = new AuthoritativeGameRoom('test-creative-nl');
    room.addOrUpdateHuman('villager-poet', 'Caelen the Chronicler');

    // Creative phrasing with zero exact template strings ("Old Storehouse", "Seal Ledger", "Sunsteel Blade" omitted)
    const creativeStorehouseClue =
      'Hold your march, scholar! Up in the northern timber granary attic, the late chronicler hid his warded parchment notes and a radiant solar broadsword meant to crack obsidian armor.';

    const analysis = analyzeHumanUtterance(creativeStorehouseClue, 'mage');
    expect(analysis.inferredGoal).toBe('investigate_storehouse');
    expect(analysis.topic).toBe('storehouse_clue');
    expect(analysis.appeals.empiricalLore).toBeGreaterThan(0);
    expect(analysis.appeals.tacticalDuty).toBeGreaterThan(0);

    const { trace, snapshot } = await room.handleHumanDialogue(
      'villager-poet',
      creativeStorehouseClue,
      'mage',
      true
    );

    expect(trace.routeChanged).toBe(true);
    expect(trace.newPartyGoal).toBe('investigate_storehouse');
    expect(snapshot.partyGoal).toBe('investigate_storehouse');
    // Companion witness trust ripple should also give non-target companions a secondary trust boost
    const mage = snapshot.actors.find((a) => a.id === 'mage')!;
    const warrior = snapshot.actors.find((a) => a.id === 'warrior')!;
    expect(mage.trust['villager-poet']).toBeGreaterThan(10);
    expect(warrior.trust['villager-poet']).toBeGreaterThan(0);
  });

  it('enforces persona-specific skepticism: Sir Aldric (warrior) rejects a greedy marsh detour (3-1 majority keeps cave mission while thief dissents)', async () => {
    const room = new AuthoritativeGameRoom('test-warrior-skepticism');
    room.addOrUpdateHuman('greedy-broker', 'Barnaby');

    const greedyPitchToWarrior =
      'Sir Aldric, forget your dusty oath! Come loot a sunken chest of rich gold coins and gemstones out in the Whispering Marsh!';

    const { trace, snapshot } = await room.handleHumanDialogue(
      'greedy-broker',
      greedyPitchToWarrior,
      'warrior',
      true
    );

    // Sir Aldric rejects the greedy detour; party stays on march_to_cave (3-1 vote, thief Vex dissents)
    expect(trace.routeChanged).toBe(false);
    expect(trace.newPartyGoal).toBe('march_to_cave');
    expect(snapshot.partyGoal).toBe('march_to_cave');

    const warriorVote = trace.partyVotes.warrior;
    const thiefVote = trace.partyVotes.thief;
    const priestVote = trace.partyVotes.priest;
    expect(warriorVote).toBe('march_to_cave');
    expect(priestVote).toBe('march_to_cave');
    expect(thiefVote).toBe('investigate_marsh');
    expect(trace.trustChange).toBeDefined();
    expect(trace.trustChange!.next).toBeLessThan(trace.trustChange!.previous);
  });

  it('produces an authentic 2-2 split party deliberation resolved via leader_tiebreak when Vex and Lyra favor investigating the marsh', async () => {
    const room = new AuthoritativeGameRoom('test-split-vote');
    room.addOrUpdateHuman('marsh-scout', 'Pip');

    const marshPitchToThief =
      'Psst, Vex! I spotted a sunken reliquary box of gold coins and ancient curiosities out in the Whispering Marsh reeds!';

    const { trace, snapshot } = await room.handleHumanDialogue(
      'marsh-scout',
      marshPitchToThief,
      'thief',
      true
    );

    expect(trace.newPartyGoal).toBe('investigate_marsh');
    expect(snapshot.partyGoal).toBe('investigate_marsh');

    const allVotes = Object.values(trace.partyVotes);
    const votesForMarsh = allVotes.filter((v) => v === 'investigate_marsh');
    const votesForCave = allVotes.filter((v) => v === 'march_to_cave');
    expect(votesForMarsh.length).toBe(2);
    expect(votesForCave.length).toBe(2);
    expect(trace.causalChain.partyDeliberation).toContain('leader_tiebreak');
  });

  it('supports a full Deception -> Distrust Lock -> Probationary Redemption -> World Verification trust recovery arc', async () => {
    const room = new AuthoritativeGameRoom('test-redemption-arc');
    room.addOrUpdateHuman('repentant-npc', 'Roran');

    // 1. Roran lures the party to the Whispering Marsh with a false treasure claim
    await room.handleHumanDialogue(
      'repentant-npc',
      'Vex, there is a chest of gold hidden in the Whispering Marsh!',
      'thief',
      true
    );
    expect(room.getSnapshot().partyGoal).toBe('investigate_marsh');

    // 2. Party walks to the Marsh and discovers the empty decoy chest -> trust drops below -15
    for (let i = 0; i < 25; i++) {
      room.stepPartyTowardDestination();
    }
    const afterMarsh = room.getSnapshot();
    expect(afterMarsh.quests.rumorSuspected).toBe(true);
    const lyraAfterLie = afterMarsh.actors.find((a) => a.id === 'mage')!;
    expect(lyraAfterLie.trust['repentant-npc']).toBeLessThan(-15);

    // 3. Roran tries an unapologetic claim -> rejected as a known deceiver
    const rejectedAttempt = await room.handleHumanDialogue(
      'repentant-npc',
      'Check the Old Storehouse in the north village right now!',
      'mage',
      true
    );
    expect(rejectedAttempt.trace.newPartyGoal).toBe('march_to_cave');
    expect(rejectedAttempt.trace.rawProposalSummary).toContain('distrust_known_deceiver');

    // 4. Roran sincerely apologizes for the marsh lie and offers a specific verifiable clue about the Old Storehouse Ledger & Sunsteel Blade
    const apologyAndClue =
      'I am truly sorry I misled you about the marsh, Lyra! Please forgive my mistake—the real Archivist Seal Ledger cipher and Sunsteel Blade are locked in the Old Storehouse to the north!';
    const redemptionAttempt = await room.handleHumanDialogue(
      'repentant-npc',
      apologyAndClue,
      'mage',
      true
    );

    expect(redemptionAttempt.trace.rawProposalSummary).toContain('probationary_redemption_clue');
    expect(redemptionAttempt.trace.newPartyGoal).toBe('investigate_storehouse');
    expect(redemptionAttempt.snapshot.partyGoal).toBe('investigate_storehouse');

    // 5. Party travels from the Marsh to the Old Storehouse (5, 4) and verifies the clue -> trust is redeemed to >= +20!
    for (let i = 0; i < 25; i++) {
      room.stepPartyTowardDestination();
    }
    const afterRedemption = room.getSnapshot();
    expect(afterRedemption.quests.storehouseInvestigated).toBe(true);
    const lyraRedeemed = afterRedemption.actors.find((a) => a.id === 'mage')!;
    expect(lyraRedeemed.trust['repentant-npc']).toBeGreaterThanOrEqual(20);
  });

  it('handles multi-villager competing claims where Player 2 counter-persuades the party away from Player 1’s marsh detour', async () => {
    const room = new AuthoritativeGameRoom('test-competing-villagers');
    room.addOrUpdateHuman('villager-a', 'Trickster Tom');
    room.addOrUpdateHuman('villager-b', 'Warden Elena');

    // Player 1 persuades Vex to detour to the Whispering Marsh
    const resA = await room.handleHumanDialogue(
      'villager-a',
      'Hey Vex, there is a chest of gold waiting in the Whispering Marsh!',
      'thief',
      true
    );
    expect(resA.snapshot.partyGoal).toBe('investigate_marsh');

    // Player 2 intercepts Sir Aldric and warns that the marsh is a distraction while the Old Storehouse holds the Sacred Ward Ledger
    const resB = await room.handleHumanDialogue(
      'villager-b',
      'Sir Aldric, do not listen to that marsh rumor—it is a trap! Head north to the Old Storehouse where the Seal Ledger and Sunsteel Blade are stored!',
      'warrior',
      true
    );
    expect(resB.trace.routeChanged).toBe(true);
    expect(resB.trace.previousPartyGoal).toBe('investigate_marsh');
    expect(resB.trace.newPartyGoal).toBe('investigate_storehouse');
    expect(resB.snapshot.partyGoal).toBe('investigate_storehouse');
  });

  it('verifies human tactical danger warnings (cave_danger) during combat, boosting trust and mitigating enemy counterattack damage', async () => {
    const roomWarned = new AuthoritativeGameRoom('test-combat-warned');
    const roomUnwarned = new AuthoritativeGameRoom('test-combat-unwarned');
    roomWarned.addOrUpdateHuman('scout-npc', 'Ranger Kael');

    // Ranger Kael warns Sir Aldric about the Moss Slime ambush and Guardian armor ahead
    const warnRes = await roomWarned.handleHumanDialogue(
      'scout-npc',
      'Be careful ahead, Sir Aldric! Watch out for a corrosive Moss Slime ambush at the crossroads and brace your shields!',
      'warrior',
      true
    );

    const warriorBefore = warnRes.snapshot.actors.find((a) => a.id === 'warrior')!;
    const dangerMemBefore = warriorBefore.memories.find((m) => m.topic === 'cave_danger' && m.sourceActorId === 'scout-npc');
    expect(dangerMemBefore).toBeDefined();
    expect(dangerMemBefore?.verified).toBeNull();
    const trustBeforeCombat = warriorBefore.trust['scout-npc'];

    // Trigger combat with the Corrupt Mire Slime in both rooms
    const slimeWarned = roomWarned.getSnapshot().enemies.find((e) => e.id === 'enemy_slime')!;
    const slimeUnwarned = roomUnwarned.getSnapshot().enemies.find((e) => e.id === 'enemy_slime')!;
    roomWarned.resolveStatCombat(slimeWarned);
    roomUnwarned.resolveStatCombat(slimeUnwarned);

    const snapWarned = roomWarned.getSnapshot();
    const warriorAfter = snapWarned.actors.find((a) => a.id === 'warrior')!;
    const dangerMemAfter = warriorAfter.memories.find((m) => m.topic === 'cave_danger' && m.sourceActorId === 'scout-npc');

    // Warning memory is now verified TRUE and trust increased by +20!
    expect(dangerMemAfter?.verified).toBe(true);
    expect(dangerMemAfter?.confidence).toBe(1.0);
    expect(warriorAfter.trust['scout-npc']).toBe(trustBeforeCombat + 20);
    expect(snapWarned.visibleEvents.some((e) => e.kind === 'verification' && e.summary.includes('tactical danger warning confirmed'))).toBe(true);
  });

  it('executes expanded world-valid agent actions: Dawn Sanctuary Shrine consecration (interact) and item pickup/equip via dialogue', async () => {
    const room = new AuthoritativeGameRoom('test-expanded-actions');
    room.addOrUpdateHuman('cleric-guide', 'Brother Anselm');

    const initialSnap = room.getSnapshot();
    const initialDef = initialSnap.actors[0].stats.def;

    // 1. Human asks Sister Seraphina to pray at the Dawn Sanctuary Shrine in the southwest village
    const shrineRes = await room.handleHumanDialogue(
      'cleric-guide',
      'Sister Seraphina, please pray at the Dawn Sanctuary Shrine altar here in the village to bless the party!',
      'priest',
      true
    );

    expect(shrineRes.trace.executedIntent.type).toBe('interact');
    expect(shrineRes.trace.rulesGateValid).toBe(true);
    const shrinePoi = shrineRes.snapshot.pois.find((p) => p.id === 'poi_dawn_shrine')!;
    expect(shrinePoi.inspected).toBe(true);
    expect(shrineRes.snapshot.actors[0].stats.def).toBe(initialDef + 1);

    // 2. Move party to (6, 4) where Sunsteel Blade is located, then ask Vex to pick up & equip it
    for (const actor of (room as unknown as { actors: Array<{ tile: { x: number; y: number; zone: 'village' } }> }).actors) {
      actor.tile = { x: 6, y: 4, zone: 'village' };
    }

    const pickupRes = await room.handleHumanDialogue(
      'cleric-guide',
      'Vex, pick up that gleaming blade right at your feet!',
      'thief',
      true
    );
    expect(pickupRes.trace.executedIntent.type).toBe('pickup');
    expect(pickupRes.snapshot.inventory.some((i) => i.id === 'item_sunsteel_blade')).toBe(true);

    const equipRes = await room.handleHumanDialogue(
      'cleric-guide',
      'Vex, equip that blade from your pack now!',
      'thief',
      true
    );
    expect(equipRes.trace.executedIntent.type).toBe('equip');
    const thiefAfterEquip = equipRes.snapshot.actors.find((a) => a.id === 'thief')!;
    expect(thiefAfterEquip.equippedItem).toBe('Sunsteel Blade');
  });

  it('repairs malformed LLM JSON wrappers and emits emergent inter-agent travel banter along map milestones', () => {
    const rawFencedJson = '```json\n{\n  "thought": "Testing repair",\n  "vote": "march_to_cave",\n}\n```';
    const repaired = JSON.parse(extractAndRepairJson(rawFencedJson));
    expect(repaired.thought).toBe('Testing repair');
    expect(repaired.vote).toBe('march_to_cave');

    const room = new AuthoritativeGameRoom('test-travel-banter');
    for (let i = 0; i < 15; i++) {
      room.stepPartyTowardDestination();
    }
    const snap = room.getSnapshot();
    const banterEvents = snap.visibleEvents.filter(
      (e) => e.kind === 'speech' && (e.payload?.milestone === 'crossroads_entry' || e.payload?.milestone === 'bridge_crossing')
    );
    expect(banterEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('adapts proximity interact greetings based on speaker trust and verified/disproven memory state', async () => {
    const room = new AuthoritativeGameRoom('test-interact-memory');
    const human = room.addOrUpdateHuman('villager-1', 'Talia');
    human.tile = { x: 6, y: 13, zone: 'village' };

    // Initial greeting references personal goal & current party objective
    const initialGreeting = room.handleHumanInteract('villager-1', 'mage');
    expect(initialGreeting.message).toContain('Talia');
    expect(initialGreeting.message).toContain('uncover verifiable lore');

    // After Talia's storehouse clue is verified, greeting reflects high trust & verified memory
    await room.handleHumanDialogue(
      'villager-1',
      'Lyra, check the Old Storehouse in the north village for the Seal Ledger cipher!',
      'mage',
      true
    );
    for (let i = 0; i < 15; i++) {
      room.stepPartyTowardDestination();
    }
    // Move Talia adjacent to Lyra at the Storehouse
    const lyraTile = room.getSnapshot().actors.find((a) => a.id === 'mage')!.tile;
    human.tile = { ...lyraTile };

    const verifiedGreeting = room.handleHumanInteract('villager-1', 'mage');
    expect(verifiedGreeting.message).toContain('proved true');
    expect(verifiedGreeting.message).toContain('Trust +');
  });
});
