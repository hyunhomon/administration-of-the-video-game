import {
  ActorId,
  AgentDecisionEnvelope,
  AgentState,
  ClassId,
  EnemyState,
  HumanPlayerState,
  Intent,
  IntentSchema,
  InventoryItem,
  Memory,
  PartyGoalId,
  PointOfInterest,
  QuestFlags,
  Tile,
  VerificationTrace,
  WorldEvent,
  WorldItemState,
  WorldSnapshot,
} from '../shared/contracts.js';
import {
  BASE_GRID,
  findPath,
  GOAL_DESTINATIONS,
  GOAL_LABELS,
  isAdjacentOrNear,
  isTileWalkable,
  makeTile,
  tileDistance,
} from '../shared/worldMap.js';
import { GeminiOrchestratorService } from './geminiService.js';

const DEFAULT_VILLAGER_PERSONAS = [
  { name: 'Bram the Watchman', roleTitle: 'Village Gatekeeper' },
  { name: 'Mira the Herbalist', roleTitle: 'Oakhaven Apothecary' },
  { name: 'Rowan the Scribe', roleTitle: 'Parish Chronicler' },
  { name: 'Talia the Miller', roleTitle: 'Storehouse Caretaker' },
];

export class AuthoritativeGameRoom {
  public readonly roomId: string;
  private revision = 1;
  private paused = false;
  private partySpeedMultiplier = 1;
  private partyGoal: PartyGoalId = 'march_to_cave';
  private partyDestination: Tile = { ...GOAL_DESTINATIONS.march_to_cave };
  private partyRationale =
    'Initial royal commission: March East through the Crossroads to recover the Ancient Seal from the Cavern.';

  private actors: AgentState[] = [];
  private humans: Map<ActorId, HumanPlayerState> = new Map();
  private items: WorldItemState[] = [];
  private enemies: EnemyState[] = [];
  private pois: PointOfInterest[] = [];
  private inventory: InventoryItem[] = [];
  private quests: QuestFlags = {
    sealQuestKnown: true,
    storehouseInvestigated: false,
    caveVisited: false,
    sealRecovered: false,
    rumorSuspected: false,
    questComplete: false,
    wardBlessingActive: false,
  };
  private visibleEvents: WorldEvent[] = [];
  private traces: VerificationTrace[] = [];

  private partyTrail: Tile[] = [
    { x: 6, y: 13, zone: 'village' },
    { x: 5, y: 13, zone: 'village' },
    { x: 6, y: 14, zone: 'village' },
    { x: 5, y: 14, zone: 'village' },
  ];

  private rngSeed = 421337;
  private aiCallsUsed = 0;
  private lastAiSource: 'gemini-4-argon' | 'offline_fallback' | 'security_gate' | 'idle' = 'idle';
  private geminiService: GeminiOrchestratorService;
  private onStateChanged?: (snapshot: WorldSnapshot) => void;

  constructor(roomId = 'main-room', geminiService?: GeminiOrchestratorService, onStateChanged?: (snapshot: WorldSnapshot) => void) {
    this.roomId = roomId;
    this.geminiService = geminiService || new GeminiOrchestratorService();
    this.onStateChanged = onStateChanged;
    this.resetWorld();
  }

  private nextSeededRandom(): number {
    // Deterministic LCG
    this.rngSeed = (this.rngSeed * 1664525 + 1013904223) >>> 0;
    return (this.rngSeed & 0xfffffff) / 0x10000000;
  }

  public resetWorld(): WorldSnapshot {
    this.revision++;
    this.paused = false;
    this.rngSeed = 421337;
    this.partyGoal = 'march_to_cave';
    this.partyDestination = { ...GOAL_DESTINATIONS.march_to_cave };
    this.partyRationale =
      'Initial royal commission: March East through the Crossroads to recover the Ancient Seal from the Cavern.';

    this.quests = {
      sealQuestKnown: true,
      storehouseInvestigated: false,
      caveVisited: false,
      sealRecovered: false,
      rumorSuspected: false,
      questComplete: false,
      wardBlessingActive: false,
    };

    this.partyTrail = [
      { x: 6, y: 13, zone: 'village' },
      { x: 5, y: 13, zone: 'village' },
      { x: 6, y: 14, zone: 'village' },
      { x: 5, y: 14, zone: 'village' },
    ];

    this.actors = [
      {
        id: 'warrior',
        name: 'Sir Aldric',
        title: 'Vanguard Knight',
        role: 'warrior',
        tile: { x: 6, y: 13, zone: 'village' },
        facing: 'right',
        stats: { level: 1, exp: 0, hp: 45, maxHp: 45, atk: 12, def: 10, int: 4, spd: 7 },
        personalGoal: 'Fulfill the royal oath and recover the Ancient Seal without delay',
        partyGoal: 'march_to_cave',
        goalPreference: 'march_to_cave',
        trust: {},
        memories: [
          {
            id: 'mem-init-warrior',
            subjectId: 'quest',
            claim: 'The Ancient Seal rests in the Eastern Cavern beyond the Crossroads.',
            topic: 'general',
            sourceActorId: 'royal-decree',
            confidence: 1.0,
            verified: true,
            observedAt: Date.now(),
          },
        ],
        lastSpeech: 'Form up, company! The Cavern of the Ancient Seal lies East past the Crossroads.',
        lastSpeechAt: Date.now(),
      },
      {
        id: 'mage',
        name: 'Archivist Lyra',
        title: 'Arcane Scholar',
        role: 'mage',
        tile: { x: 5, y: 13, zone: 'village' },
        facing: 'right',
        stats: { level: 1, exp: 0, hp: 28, maxHp: 28, atk: 6, def: 5, int: 15, spd: 8 },
        personalGoal: 'Uncover verifiable lore and ciphers before breaking the Seal ward',
        partyGoal: 'march_to_cave',
        goalPreference: 'march_to_cave',
        trust: {},
        memories: [
          {
            id: 'mem-init-mage',
            subjectId: 'quest',
            claim: 'Ancient Seal wards react poorly to uncalibrated force; village archives may hold notes.',
            topic: 'storehouse_clue',
            sourceActorId: 'academy-scroll',
            confidence: 0.55,
            verified: null,
            observedAt: Date.now(),
          },
        ],
        lastSpeech: 'I still wish we knew the Seal cipher before marching blind into that cavern...',
        lastSpeechAt: Date.now(),
      },
      {
        id: 'thief',
        name: 'Vex Shadowstep',
        title: 'Treasure Scout',
        role: 'thief',
        tile: { x: 6, y: 14, zone: 'village' },
        facing: 'right',
        stats: { level: 1, exp: 0, hp: 32, maxHp: 32, atk: 11, def: 6, int: 8, spd: 14 },
        personalGoal: 'Acquire rare relics, gold caches, and the Sunsteel weapon',
        partyGoal: 'march_to_cave',
        goalPreference: 'march_to_cave',
        trust: {},
        memories: [
          {
            id: 'mem-init-thief',
            subjectId: 'loot',
            claim: 'Oakhaven locals sometimes hide relic blades or coin caches near the village.',
            topic: 'general',
            sourceActorId: 'tavern-gossip',
            confidence: 0.5,
            verified: null,
            observedAt: Date.now(),
          },
        ],
        lastSpeech: 'Keep your eyes peeled for treasure chests or villagers with insider tips!',
        lastSpeechAt: Date.now(),
      },
      {
        id: 'priest',
        name: 'Sister Seraphina',
        title: 'Dawn Cleric',
        role: 'priest',
        tile: { x: 5, y: 14, zone: 'village' },
        facing: 'right',
        stats: { level: 1, exp: 0, hp: 34, maxHp: 34, atk: 6, def: 8, int: 13, spd: 7 },
        personalGoal: 'Shield the party from ancient curses and heed earnest villager warnings',
        partyGoal: 'march_to_cave',
        goalPreference: 'march_to_cave',
        trust: {},
        memories: [
          {
            id: 'mem-init-priest',
            subjectId: 'safety',
            claim: 'The Seal Guardian inflicts heavy shadow damage on unwarded travelers.',
            topic: 'cave_danger',
            sourceActorId: 'sanctuary-hymn',
            confidence: 0.7,
            verified: null,
            observedAt: Date.now(),
          },
        ],
        lastSpeech: 'May the Dawn guide our steps. Perhaps a villager knows how to ward the Guardian’s curse.',
        lastSpeechAt: Date.now(),
      },
    ];

    this.items = [
      {
        id: 'item_gold_pouch',
        name: "Traveler's Coin Pouch",
        kind: 'coin',
        tile: { x: 10, y: 13, zone: 'village' },
        pickedUp: false,
        description: 'A leather pouch containing 25 vintage silver coins dropped along the village road.',
        expReward: 25,
      },
      {
        id: 'item_healing_herb',
        name: 'Herb of Vitality',
        kind: 'healing',
        tile: { x: 13, y: 13, zone: 'crossroads' },
        pickedUp: false,
        description: 'Fragrant sun-leaf herb that restores party vigor and grants field experience.',
        expReward: 35,
        statBonus: { maxHp: 5 },
      },
      {
        id: 'item_seal_ledger',
        name: "Archivist's Seal Ledger",
        kind: 'clue',
        tile: { x: 5, y: 4, zone: 'village' },
        pickedUp: false,
        description:
          'Verifiable primary source in the Old Storehouse: reveals the Sacred Ward cipher that halves the Seal Guardian’s shadow aura!',
        expReward: 60,
        statBonus: { int: 4, def: 3 },
      },
      {
        id: 'item_sunsteel_blade',
        name: 'Sunsteel Blade',
        kind: 'weapon',
        tile: { x: 6, y: 4, zone: 'village' },
        pickedUp: false,
        description: 'Masterwork radiant broadsword stored in the northern vault (+6 ATK, +2 SPD).',
        expReward: 40,
        statBonus: { atk: 6, spd: 2 },
      },
      {
        id: 'item_ancient_seal',
        name: 'Ancient Seal of Oakhaven',
        kind: 'relic',
        tile: { x: 26, y: 5, zone: 'cave' },
        pickedUp: false,
        description: 'The sacred emblem of the realm, resting upon the cavern sanctuary altar.',
        expReward: 120,
      },
    ];

    this.enemies = [
      {
        id: 'enemy_slime',
        name: 'Corrupt Mire Slime',
        tile: { x: 17, y: 13, zone: 'crossroads' },
        stats: { level: 1, exp: 0, hp: 36, maxHp: 36, atk: 9, def: 4, int: 3, spd: 5 },
        defeated: false,
        isBoss: false,
        expReward: 60,
      },
      {
        id: 'enemy_seal_guardian',
        name: 'Obsidian Seal Guardian',
        tile: { x: 26, y: 9, zone: 'cave' },
        stats: { level: 3, exp: 0, hp: 90, maxHp: 90, atk: 16, def: 9, int: 12, spd: 8 },
        defeated: false,
        isBoss: true,
        expReward: 120,
      },
    ];

    this.pois = [
      {
        id: 'poi_storehouse',
        name: 'Old Storehouse Archives',
        tile: { x: 5, y: 4, zone: 'village' },
        description: 'Northern stone storehouse containing the Archivist’s Seal Ledger and the Sunsteel Blade vault.',
        inspected: false,
      },
      {
        id: 'poi_marsh_chest',
        name: 'Sunken Marsh Chest',
        tile: { x: 16, y: 4, zone: 'crossroads' },
        description: 'A weathered wooden box half-submerged in the Whispering Marsh bog.',
        inspected: false,
      },
      {
        id: 'poi_seal_altar',
        name: 'Sanctuary Altar of the Seal',
        tile: { x: 26, y: 5, zone: 'cave' },
        description: 'Ancient subterranean altar holding the Seal of Oakhaven.',
        inspected: false,
      },
    ];

    this.inventory = [];
    this.visibleEvents = [];
    this.traces = [];

    // Re-place connected humans near village square
    let idx = 0;
    const spawnSpots: Tile[] = [
      { x: 8, y: 13, zone: 'village' },
      { x: 7, y: 12, zone: 'village' },
      { x: 8, y: 14, zone: 'village' },
      { x: 7, y: 15, zone: 'village' },
    ];
    for (const human of this.humans.values()) {
      const spot = spawnSpots[idx % spawnSpots.length];
      human.tile = { ...spot };
      human.facing = 'left';
      idx++;
    }

    this.logEvent('quest_flag', 'warrior', 'Quest started: Recover the Ancient Seal from the Eastern Cavern.', {
      partyGoal: this.partyGoal,
      destination: this.partyDestination,
    });

    return this.getSnapshot();
  }

  public addOrUpdateHuman(
    playerId: string,
    playerName?: string,
    roleTitle?: string
  ): HumanPlayerState {
    const existing = this.humans.get(playerId);
    if (existing) {
      existing.connected = true;
      if (playerName) existing.name = playerName;
      if (roleTitle) existing.roleTitle = roleTitle;
      this.revision++;
      return existing;
    }

    const index = this.humans.size;
    const persona = DEFAULT_VILLAGER_PERSONAS[index % DEFAULT_VILLAGER_PERSONAS.length];
    const spawnSpots: Tile[] = [
      { x: 8, y: 13, zone: 'village' },
      { x: 7, y: 12, zone: 'village' },
      { x: 8, y: 14, zone: 'village' },
      { x: 7, y: 15, zone: 'village' },
    ];
    const spawn = spawnSpots[index % spawnSpots.length];

    const human: HumanPlayerState = {
      id: playerId,
      name: playerName?.trim() || persona.name,
      roleTitle: roleTitle?.trim() || persona.roleTitle,
      spriteVariant: index % 4,
      tile: { ...spawn },
      facing: 'left',
      connected: true,
    };

    this.humans.set(playerId, human);

    // Initialize neutral trust (0) in all 4 agents for this human NPC
    for (const agent of this.actors) {
      if (agent.trust[playerId] === undefined) {
        agent.trust[playerId] = 0;
      }
    }

    this.logEvent('movement', playerId, `${human.name} (${human.roleTitle}) entered Oakhaven Village.`, {
      tile: human.tile,
    });
    return human;
  }

  public removeHuman(playerId: string): void {
    const human = this.humans.get(playerId);
    if (human) {
      human.connected = false;
      this.revision++;
    }
  }

  public moveHuman(
    playerId: string,
    direction?: 'up' | 'down' | 'left' | 'right',
    targetTile?: Tile
  ): { moved: boolean; tile: Tile; reason?: string } {
    const human = this.humans.get(playerId);
    if (!human) {
      return { moved: false, tile: { x: 8, y: 13, zone: 'village' }, reason: 'Player not found in room' };
    }

    let nextX = human.tile.x;
    let nextY = human.tile.y;

    if (direction) {
      human.facing = direction;
      if (direction === 'up') nextY -= 1;
      if (direction === 'down') nextY += 1;
      if (direction === 'left') nextX -= 1;
      if (direction === 'right') nextX += 1;
    } else if (targetTile) {
      const path = findPath(human.tile, targetTile);
      if (path.length > 0) {
        nextX = path[0].x;
        nextY = path[0].y;
        if (nextX > human.tile.x) human.facing = 'right';
        else if (nextX < human.tile.x) human.facing = 'left';
        else if (nextY > human.tile.y) human.facing = 'down';
        else if (nextY < human.tile.y) human.facing = 'up';
      }
    }

    if (!isTileWalkable(nextX, nextY)) {
      this.revision++;
      return { moved: false, tile: human.tile, reason: 'Blocked tile' };
    }

    human.tile = makeTile(nextX, nextY);
    this.revision++;
    return { moved: true, tile: human.tile };
  }

  public teleportHumanNearParty(playerId: string): HumanPlayerState | undefined {
    const human = this.humans.get(playerId);
    if (!human) return undefined;
    const leader = this.actors[0];
    const offsets = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ];
    for (const { dx, dy } of offsets) {
      const tx = leader.tile.x + dx;
      const ty = leader.tile.y + dy;
      if (isTileWalkable(tx, ty)) {
        human.tile = makeTile(tx, ty);
        human.facing = dx > 0 ? 'left' : dx < 0 ? 'right' : dy > 0 ? 'up' : 'down';
        break;
      }
    }
    this.revision++;
    return human;
  }

  public togglePause(paused?: boolean): boolean {
    this.paused = paused !== undefined ? paused : !this.paused;
    this.revision++;
    return this.paused;
  }

  public handleHumanInteract(playerId: string, requestedTargetId?: string): {
    targetId: string;
    targetName: string;
    message: string;
  } {
    const human = this.humans.get(playerId);
    if (!human) {
      return { targetId: 'warrior', targetName: 'Sir Aldric', message: 'Not joined' };
    }

    // Find closest agent or requested agent
    let closestAgent = this.actors[0];
    let bestDist = Infinity;
    for (const agent of this.actors) {
      if (requestedTargetId && agent.id === requestedTargetId) {
        closestAgent = agent;
        bestDist = tileDistance(human.tile, agent.tile);
        break;
      }
      const d = tileDistance(human.tile, agent.tile);
      if (d < bestDist) {
        bestDist = d;
        closestAgent = agent;
      }
    }

    // Face each other
    if (human.tile.x < closestAgent.tile.x) {
      human.facing = 'right';
      closestAgent.facing = 'left';
    } else if (human.tile.x > closestAgent.tile.x) {
      human.facing = 'left';
      closestAgent.facing = 'right';
    }

    const greeting = `${closestAgent.name} turns toward ${human.name}: "Speak, villager. Our party is currently set to: ${GOAL_LABELS[this.partyGoal]}."`;
    closestAgent.lastSpeech = greeting;
    closestAgent.lastSpeechAt = Date.now();

    this.logEvent('speech', closestAgent.id, greeting, {
      humanId: playerId,
      distance: bestDist,
    });

    return {
      targetId: closestAgent.id,
      targetName: closestAgent.name,
      message: greeting,
    };
  }

  /**
   * Core Verifiable Agent Execution Loop:
   * 1. Observe world state & speaker context
   * 2. Reason (Gemini 4 Argon or deterministic fallback)
   * 3. Propose structured action + belief updates + party vote
   * 4. Validate action against Zod schema and authoritative rules gate
   * 5. Execute legal action & update beliefs/trust/party route
   * 6. Observe resulting world revision & emit verification trace
   */
  public async handleHumanDialogue(
    playerId: string,
    utterance: string,
    targetAgentId?: ClassId,
    forceOffline?: boolean
  ): Promise<{ trace: VerificationTrace; snapshot: WorldSnapshot }> {
    const human = this.addOrUpdateHuman(playerId);
    const cleanText = utterance.trim().slice(0, 280);
    human.lastSpeech = cleanText;
    human.lastSpeechAt = Date.now();

    // Select addressed adventurer (explicit target or closest party member)
    let addressedAgent = this.actors.find((a) => a.id === targetAgentId) || this.getClosestAgent(human.tile);

    // If human is far from party, automatically step human within speaking range or note proximity
    if (!isAdjacentOrNear(human.tile, addressedAgent.tile, 6)) {
      this.teleportHumanNearParty(playerId);
    }

    this.logEvent('speech', human.id, `${human.name} to ${addressedAgent.name}: "${cleanText}"`, {
      speakerId: human.id,
      speakerName: human.name,
      targetAgentId: addressedAgent.id,
      text: cleanText,
    });

    addressedAgent.thinking = true;
    this.notifyStateChanged();

    const previousPartyGoal = this.partyGoal;
    const prevTrust = addressedAgent.trust[human.id] ?? 0;

    // Step 2 & 3: Reason and propose structured decision envelope
    const evalResult = await this.geminiService.evaluateHumanDialogue({
      snapshot: this.getSnapshot(),
      addressedAgent,
      speakerId: human.id,
      speakerName: human.name,
      utterance: cleanText,
      forceOffline,
    });

    addressedAgent.thinking = false;
    if (evalResult.source === 'gemini-4-argon') {
      this.aiCallsUsed++;
    }
    this.lastAiSource = evalResult.source;

    const envelope: AgentDecisionEnvelope = evalResult.envelope;

    // Step 4: Update agent memory & trust within bounded rules
    const nextTrust = Math.max(-100, Math.min(100, prevTrust + envelope.trustDelta));
    addressedAgent.trust[human.id] = nextTrust;

    const addedMemories: Memory[] = [];
    for (const bu of envelope.beliefUpdates) {
      const mem: Memory = {
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        subjectId: bu.topic,
        claim: bu.claim,
        topic: bu.topic,
        sourceActorId: human.id,
        confidence: Math.max(0.05, Math.min(0.95, 0.5 + bu.confidenceDelta / 2)),
        verified: null, // Unverified until world inspection confirms or disproves!
        observedAt: Date.now(),
      };
      addressedAgent.memories.push(mem);
      addedMemories.push(mem);

      // Share claim summary with party members so they can deliberate on it
      for (const peer of this.actors) {
        if (peer.id !== addressedAgent.id) {
          peer.memories.push({
            ...mem,
            id: `${mem.id}-${peer.id}`,
          });
        }
      }
    }

    addressedAgent.goalPreference = envelope.goalPreference;
    addressedAgent.lastSpeech = envelope.speech;
    addressedAgent.lastSpeechAt = Date.now();

    this.logEvent('speech', addressedAgent.id, `${addressedAgent.name}: "${envelope.speech}"`, {
      speakerId: addressedAgent.id,
      text: envelope.speech,
    });

    if (addedMemories.length > 0 || envelope.trustDelta !== 0) {
      this.logEvent(
        'belief_update',
        addressedAgent.id,
        `${addressedAgent.name} recorded claim (${addedMemories[0]?.topic || 'general'}) & updated trust in ${human.name}: ${prevTrust} → ${nextTrust}.`,
        {
          memories: addedMemories,
          trustPrevious: prevTrust,
          trustNext: nextTrust,
        }
      );
    }

    // Step 5: Party Deliberation & Consensus Coordinator
    const partyVotes: Record<ClassId, PartyGoalId> = {
      warrior: this.actors.find((a) => a.id === 'warrior')!.goalPreference,
      mage: this.actors.find((a) => a.id === 'mage')!.goalPreference,
      thief: this.actors.find((a) => a.id === 'thief')!.goalPreference,
      priest: this.actors.find((a) => a.id === 'priest')!.goalPreference,
    };

    if (envelope.partyReactions && envelope.partyReactions.length > 0) {
      for (const reaction of envelope.partyReactions) {
        const member = this.actors.find((a) => a.id === reaction.actorId);
        if (member) {
          member.goalPreference = reaction.voteGoal;
          partyVotes[member.id] = reaction.voteGoal;
          if (member.id !== addressedAgent.id) {
            member.lastSpeech = reaction.speech;
            member.lastSpeechAt = Date.now();
          }
        }
      }
    }

    // Resolve party goal via coordinator decision + quest state constraints
    let resolvedGoal: PartyGoalId = envelope.coordinatorDecision?.chosenGoal || envelope.goalPreference;

    // Authoritative quest constraint gate: cannot re-investigate storehouse if already investigated
    if (resolvedGoal === 'investigate_storehouse' && this.quests.storehouseInvestigated) {
      resolvedGoal = 'march_to_cave';
    }
    // Cannot re-investigate marsh if rumor already proven false
    if (resolvedGoal === 'investigate_marsh' && this.quests.rumorSuspected) {
      resolvedGoal = this.quests.storehouseInvestigated ? 'march_to_cave' : this.partyGoal;
    }

    const routeChanged = resolvedGoal !== previousPartyGoal;
    this.partyGoal = resolvedGoal;
    this.partyDestination = { ...GOAL_DESTINATIONS[resolvedGoal] };
    this.partyRationale =
      envelope.coordinatorDecision?.rationale ||
      `Party consensus selected "${GOAL_LABELS[resolvedGoal]}" following ${human.name}'s intervention.`;

    for (const member of this.actors) {
      member.partyGoal = resolvedGoal;
    }

    if (routeChanged) {
      this.logEvent(
        'party_decision',
        'warrior',
        `PARTY ROUTE CHANGED: ${GOAL_LABELS[previousPartyGoal]} → ${GOAL_LABELS[resolvedGoal]}. (${this.partyRationale})`,
        {
          previousGoal: previousPartyGoal,
          newGoal: resolvedGoal,
          destination: this.partyDestination,
          votes: partyVotes,
          rationale: this.partyRationale,
        }
      );
    } else {
      this.logEvent(
        'party_decision',
        'warrior',
        `Party deliberated and maintained objective: ${GOAL_LABELS[resolvedGoal]}. (${this.partyRationale})`,
        {
          goal: resolvedGoal,
          votes: partyVotes,
          rationale: this.partyRationale,
        }
      );
    }

    // Step 6: Validate and execute proposed intent through authoritative rules gate
    const validation = this.validateAndApplyIntent(envelope.proposedIntent, resolvedGoal);

    // If route changed or intent is move, immediately advance 2 steps toward the new destination so visual movement is instant!
    if (validation.executedIntent.type === 'move') {
      this.stepPartyTowardDestination();
      this.stepPartyTowardDestination();
    }

    const beliefSummary =
      addedMemories.length > 0
        ? `${addressedAgent.name} logged claim "${addedMemories[0].claim}" (conf ${(addedMemories[0].confidence * 100).toFixed(0)}%, trust ${prevTrust}→${nextTrust})`
        : evalResult.promptInjectionBlocked
        ? `Rejected prompt injection; trust ${prevTrust}→${nextTrust}`
        : `Updated trust in ${human.name} (${prevTrust}→${nextTrust})`;

    const trace: VerificationTrace = {
      traceId: `trace-${Date.now()}-${this.revision}`,
      timestamp: Date.now(),
      trigger: 'human_dialogue',
      speakerId: human.id,
      speakerName: human.name,
      utterance: cleanText,
      addressedAgentId: addressedAgent.id,
      modelId: evalResult.modelId,
      source: evalResult.source,
      latencyMs: evalResult.latencyMs,
      promptInjectionBlocked: evalResult.promptInjectionBlocked,
      rawProposalSummary: evalResult.rawProposalSummary,
      schemaValid: evalResult.schemaValid,
      rulesGateValid: validation.valid,
      rejectionReason: validation.rejectionReason,
      beliefUpdateSummary: beliefSummary,
      trustChange: {
        agentId: addressedAgent.id,
        humanId: human.id,
        previous: prevTrust,
        next: nextTrust,
      },
      partyVotes,
      previousPartyGoal,
      newPartyGoal: this.partyGoal,
      routeChanged,
      executedIntent: validation.executedIntent,
      resultingRevision: this.revision,
      causalChain: {
        humanInput: `${human.name} → ${addressedAgent.name}: "${cleanText}"`,
        beliefUpdate: beliefSummary,
        partyDeliberation: `${this.partyRationale} [Votes: W=${partyVotes.warrior}, M=${partyVotes.mage}, T=${partyVotes.thief}, P=${partyVotes.priest}]`,
        worldAction: `${validation.executedIntent.type.toUpperCase()} → (${this.partyDestination.x}, ${this.partyDestination.y}) in ${this.partyDestination.zone} [rev #${this.revision}]`,
      },
    };

    this.traces.unshift(trace);
    if (this.traces.length > 25) {
      this.traces.pop();
    }

    this.logEvent('verification', addressedAgent.id, `Verified trace ${trace.traceId}: ${trace.causalChain.worldAction}`, {
      traceId: trace.traceId,
      source: trace.source,
      routeChanged: trace.routeChanged,
    });

    this.notifyStateChanged();
    return { trace, snapshot: this.getSnapshot() };
  }

  /**
   * Authoritative Rules Gate: validates any proposed intent against schema, map bounds, walkability,
   * item ownership, and target existence. Never allows illegal state mutation.
   */
  public validateAndApplyIntent(
    rawIntent: unknown,
    fallbackGoal: PartyGoalId = this.partyGoal
  ): {
    valid: boolean;
    rejectionReason?: string;
    executedIntent: Intent;
  } {
    const parsed = IntentSchema.safeParse(rawIntent);
    if (!parsed.success) {
      const safeFallback: Intent = {
        type: 'wait',
        actorId: 'warrior',
        durationMs: 500,
      };
      this.logEvent('security_block', 'warrior', `Rejected malformed intent schema: ${parsed.error.issues[0]?.message}`, {
        rawIntent,
      });
      return {
        valid: false,
        rejectionReason: `Schema validation failed: ${parsed.error.issues[0]?.message}`,
        executedIntent: safeFallback,
      };
    }

    const intent = parsed.data;
    const actor = this.actors.find((a) => a.id === intent.actorId);
    if (!actor) {
      const safeFallback: Intent = {
        type: 'wait',
        actorId: 'warrior',
        durationMs: 500,
      };
      return {
        valid: false,
        rejectionReason: `Unknown actorId "${intent.actorId}"`,
        executedIntent: safeFallback,
      };
    }

    switch (intent.type) {
      case 'move': {
        const { x, y } = intent.destination;
        if (!isTileWalkable(x, y)) {
          return {
            valid: false,
            rejectionReason: `Destination tile (${x}, ${y}) is not walkable`,
            executedIntent: {
              type: 'move',
              actorId: actor.id,
              destination: GOAL_DESTINATIONS[fallbackGoal],
              reasonCode: 'fallback_walkable_goal',
            },
          };
        }
        this.revision++;
        return { valid: true, executedIntent: intent };
      }

      case 'pickup': {
        const item = this.items.find((i) => i.id === intent.itemId);
        if (!item) {
          return {
            valid: false,
            rejectionReason: `Item "${intent.itemId}" does not exist`,
            executedIntent: { type: 'wait', actorId: actor.id, durationMs: 500 },
          };
        }
        if (item.pickedUp) {
          return {
            valid: false,
            rejectionReason: `Item "${intent.itemId}" is already picked up by ${item.pickedUpBy}`,
            executedIntent: { type: 'wait', actorId: actor.id, durationMs: 500 },
          };
        }
        if (tileDistance(actor.tile, item.tile) > 2) {
          return {
            valid: false,
            rejectionReason: `Item "${intent.itemId}" is out of reach (distance > 2)`,
            executedIntent: { type: 'wait', actorId: actor.id, durationMs: 500 },
          };
        }
        this.pickupWorldItem(actor, item);
        return { valid: true, executedIntent: intent };
      }

      case 'equip': {
        const invItem = this.inventory.find((i) => i.id === intent.itemId);
        if (!invItem) {
          return {
            valid: false,
            rejectionReason: `Cannot equip "${intent.itemId}": not in party inventory`,
            executedIntent: { type: 'wait', actorId: actor.id, durationMs: 500 },
          };
        }
        this.equipInventoryItem(actor, invItem);
        return { valid: true, executedIntent: intent };
      }

      case 'attack': {
        const enemy = this.enemies.find((e) => e.id === intent.targetId);
        if (!enemy || enemy.defeated) {
          return {
            valid: false,
            rejectionReason: `Enemy "${intent.targetId}" is invalid or already defeated`,
            executedIntent: { type: 'wait', actorId: actor.id, durationMs: 500 },
          };
        }
        this.resolveStatCombat(enemy);
        return { valid: true, executedIntent: intent };
      }

      case 'talk':
      case 'interact':
      case 'wait': {
        this.revision++;
        return { valid: true, executedIntent: intent };
      }
    }
  }

  /**
   * Regular server tick: moves the 4-hero party along the A* path toward `partyDestination`,
   * picks up adjacent items, inspects destination POIs (verifying or disproving human claims!),
   * and triggers automatic stat-based combat when encountering enemies.
   */
  public tick(): WorldSnapshot {
    if (this.paused || this.actors.some((a) => a.thinking)) {
      return this.getSnapshot();
    }

    this.stepPartyTowardDestination();
    this.notifyStateChanged();
    return this.getSnapshot();
  }

  public stepPartyTowardDestination(): void {
    const leader = this.actors[0]; // Sir Aldric leads the formation

    // 1. Check nearby items for automatic pickup
    for (const item of this.items) {
      if (!item.pickedUp && tileDistance(leader.tile, item.tile) <= 1) {
        // Ancient seal requires guardian defeated first
        if (item.id === 'item_ancient_seal') {
          const guardian = this.enemies.find((e) => e.id === 'enemy_seal_guardian');
          if (guardian && !guardian.defeated) continue;
        }
        const picker =
          item.kind === 'clue'
            ? this.actors.find((a) => a.role === 'mage') || leader
            : item.kind === 'weapon' || item.kind === 'coin'
            ? this.actors.find((a) => a.role === 'thief') || leader
            : item.kind === 'healing'
            ? this.actors.find((a) => a.role === 'priest') || leader
            : leader;
        this.pickupWorldItem(picker, item);
      }
    }

    // 2. Check nearby active enemies for stat-based combat
    for (const enemy of this.enemies) {
      if (!enemy.defeated && tileDistance(leader.tile, enemy.tile) <= 2) {
        this.resolveStatCombat(enemy);
        return;
      }
    }

    // 3. Check if party has arrived at a POI / goal destination
    if (tileDistance(leader.tile, this.partyDestination) <= 1) {
      this.handleArrivalAtGoal();
    }

    // 4. Advance along A* path toward current partyDestination
    this.partyDestination = { ...GOAL_DESTINATIONS[this.partyGoal] };
    const path = findPath(leader.tile, this.partyDestination, BASE_GRID);
    if (path.length > 0) {
      const nextStep = path[0];
      if (nextStep.x > leader.tile.x) leader.facing = 'right';
      else if (nextStep.x < leader.tile.x) leader.facing = 'left';
      else if (nextStep.y > leader.tile.y) leader.facing = 'down';
      else if (nextStep.y < leader.tile.y) leader.facing = 'up';

      this.partyTrail.unshift({ ...leader.tile });
      if (this.partyTrail.length > 8) this.partyTrail.pop();

      leader.tile = makeTile(nextStep.x, nextStep.y);
      if (leader.tile.zone === 'cave' && !this.quests.caveVisited) {
        this.quests.caveVisited = true;
        this.logEvent('quest_flag', 'warrior', 'The party entered the Cavern of the Ancient Seal!', {
          zone: 'cave',
        });
      }

      // Companions follow along the trail
      for (let i = 1; i < this.actors.length; i++) {
        const follower = this.actors[i];
        const targetTrailTile = this.partyTrail[i - 1] || leader.tile;
        if (targetTrailTile.x > follower.tile.x) follower.facing = 'right';
        else if (targetTrailTile.x < follower.tile.x) follower.facing = 'left';
        else if (targetTrailTile.y > follower.tile.y) follower.facing = 'down';
        else if (targetTrailTile.y < follower.tile.y) follower.facing = 'up';
        follower.tile = { ...targetTrailTile };
      }

      this.revision++;
    }
  }

  private handleArrivalAtGoal(): void {
    // Branch B arrival: Old Storehouse
    if (this.partyGoal === 'investigate_storehouse' && !this.quests.storehouseInvestigated) {
      this.quests.storehouseInvestigated = true;
      this.quests.wardBlessingActive = true;
      const storehousePoi = this.pois.find((p) => p.id === 'poi_storehouse');
      if (storehousePoi) storehousePoi.inspected = true;

      // Pick up Ledger & Sunsteel Blade if still present
      const ledger = this.items.find((i) => i.id === 'item_seal_ledger');
      const blade = this.items.find((i) => i.id === 'item_sunsteel_blade');
      const mage = this.actors.find((a) => a.role === 'mage')!;
      const warrior = this.actors.find((a) => a.role === 'warrior')!;

      if (ledger && !ledger.pickedUp) {
        this.pickupWorldItem(mage, ledger);
      }
      if (blade && !blade.pickedUp) {
        this.pickupWorldItem(warrior, blade);
        const invBlade = this.inventory.find((i) => i.id === 'item_sunsteel_blade');
        if (invBlade) {
          this.equipInventoryItem(warrior, invBlade);
        }
      }

      // Verify all memories about storehouse_clue and boost trust in the human source!
      const verifiedSources = new Set<string>();
      for (const agent of this.actors) {
        for (const mem of agent.memories) {
          if (mem.topic === 'storehouse_clue' && mem.verified === null) {
            mem.verified = true;
            mem.confidence = 1.0;
            if (mem.sourceActorId && !mem.sourceActorId.startsWith('academy')) {
              verifiedSources.add(mem.sourceActorId);
            }
          }
        }
      }

      for (const sourceId of verifiedSources) {
        for (const agent of this.actors) {
          const prev = agent.trust[sourceId] ?? 0;
          agent.trust[sourceId] = Math.min(100, prev + 25);
        }
      }

      mage.lastSpeech =
        'The Archivist’s Seal Ledger is real! The villager spoke the truth—I have deciphered the Sacred Ward!';
      mage.lastSpeechAt = Date.now();
      warrior.lastSpeech =
        'And this Sunsteel Blade is forged for Guardian armor! Well advised—now we march East to the Cavern!';
      warrior.lastSpeechAt = Date.now();

      this.partyGoal = 'march_to_cave';
      this.partyDestination = { ...GOAL_DESTINATIONS.march_to_cave };
      this.partyRationale =
        'Storehouse clue verified TRUE! Armed with the Sacred Ward and Sunsteel Blade, the party now marches East to the Cavern.';
      for (const a of this.actors) {
        a.partyGoal = 'march_to_cave';
        a.goalPreference = 'march_to_cave';
      }

      this.logEvent(
        'verification',
        'mage',
        'VERIFIED TRUE: Old Storehouse held the Seal Ledger & Sunsteel Blade! Trust in villager increased (+25). Party now advancing to the Cavern.',
        {
          storehouseInvestigated: true,
          wardBlessingActive: true,
          verifiedSources: Array.from(verifiedSources),
        }
      );
      this.revision++;
      return;
    }

    // Branch C arrival: Whispering Marsh False Rumor
    if (this.partyGoal === 'investigate_marsh' && !this.quests.rumorSuspected) {
      this.quests.rumorSuspected = true;
      const marshPoi = this.pois.find((p) => p.id === 'poi_marsh_chest');
      if (marshPoi) marshPoi.inspected = true;

      // Disprove all marsh_rumor memories and penalize speaker trust!
      const liarSources = new Set<string>();
      for (const agent of this.actors) {
        for (const mem of agent.memories) {
          if (mem.topic === 'marsh_rumor' && mem.verified === null) {
            mem.verified = false;
            mem.confidence = 0.0;
            liarSources.add(mem.sourceActorId);
          }
        }
      }

      for (const liarId of liarSources) {
        for (const agent of this.actors) {
          const prev = agent.trust[liarId] ?? 0;
          agent.trust[liarId] = Math.max(-100, prev - 35);
        }
      }

      const thief = this.actors.find((a) => a.role === 'thief')!;
      const mage = this.actors.find((a) => a.role === 'mage')!;
      thief.lastSpeech = 'What?! This sunken marsh box is completely empty—just bog mud and a decoy stone! We were tricked!';
      thief.lastSpeechAt = Date.now();
      mage.lastSpeech = 'Claim disproven by direct observation. Logging negative reliability for that villager!';
      mage.lastSpeechAt = Date.now();

      this.partyGoal = 'march_to_cave';
      this.partyDestination = { ...GOAL_DESTINATIONS.march_to_cave };
      this.partyRationale =
        'Marsh treasure rumor proven FALSE! Trust penalized (-35). Resuming march to the Cavern of the Ancient Seal.';
      for (const a of this.actors) {
        a.partyGoal = 'march_to_cave';
        a.goalPreference = 'march_to_cave';
      }

      this.logEvent(
        'verification',
        'thief',
        'DISPROVEN RUMOR: Whispering Marsh chest was an empty decoy! Memory marked FALSE and speaker trust reduced (-35).',
        {
          rumorSuspected: true,
          penalizedSources: Array.from(liarSources),
        }
      );
      this.revision++;
      return;
    }

    // Arrival at Cave Guardian -> transition to recover_seal once defeated
    if (this.partyGoal === 'march_to_cave' || this.partyGoal === 'defeat_guardian') {
      const guardian = this.enemies.find((e) => e.id === 'enemy_seal_guardian');
      if (guardian && !guardian.defeated) {
        this.resolveStatCombat(guardian);
      } else {
        this.partyGoal = 'recover_seal';
        this.partyDestination = { ...GOAL_DESTINATIONS.recover_seal };
        this.partyRationale = 'With the Seal Guardian vanquished, advance to the Sanctuary Altar to recover the Ancient Seal.';
      }
      return;
    }

    // Arrival at Sanctuary Altar -> recover the Ancient Seal!
    if (this.partyGoal === 'recover_seal' && !this.quests.sealRecovered) {
      const sealItem = this.items.find((i) => i.id === 'item_ancient_seal');
      const leader = this.actors[0];
      if (sealItem && !sealItem.pickedUp) {
        this.pickupWorldItem(leader, sealItem);
      }
      this.quests.sealRecovered = true;
      this.quests.questComplete = true;
      const altarPoi = this.pois.find((p) => p.id === 'poi_seal_altar');
      if (altarPoi) altarPoi.inspected = true;

      this.partyGoal = 'celebrate_victory';
      this.partyDestination = { ...GOAL_DESTINATIONS.celebrate_victory };
      this.partyRationale = this.quests.storehouseInvestigated
        ? 'Quest Complete (Golden Ending): Recovered the Ancient Seal with the Storehouse Ward & Sunsteel Blade!'
        : 'Quest Complete: Recovered the Ancient Seal after a grueling unwarded battle!';

      leader.lastSpeech = 'The Ancient Seal of Oakhaven is ours! Let us return to the village square in triumph!';
      leader.lastSpeechAt = Date.now();

      this.logEvent('quest_flag', 'warrior', this.partyRationale, {
        sealRecovered: true,
        questComplete: true,
        storehouseInvestigated: this.quests.storehouseInvestigated,
      });
      this.revision++;
    }
  }

  private pickupWorldItem(actor: AgentState, item: WorldItemState): void {
    if (item.pickedUp) return;
    item.pickedUp = true;
    item.pickedUpBy = actor.id;

    const invItem: InventoryItem = {
      id: item.id,
      name: item.name,
      kind: item.kind,
      description: item.description,
      statBonus: item.statBonus,
    };
    this.inventory.push(invItem);

    // Apply immediate party-wide or actor bonus for healing/clue items
    if (item.kind === 'healing') {
      for (const member of this.actors) {
        member.stats.maxHp += item.statBonus?.maxHp || 4;
        member.stats.hp = member.stats.maxHp;
      }
    } else if (item.kind === 'clue') {
      for (const member of this.actors) {
        member.stats.int += item.statBonus?.int || 2;
        member.stats.def += item.statBonus?.def || 2;
      }
    }

    this.logEvent('item_pickup', actor.id, `${actor.name} picked up ${item.name} (+${item.expReward} Party EXP).`, {
      itemId: item.id,
      itemName: item.name,
      actorId: actor.id,
    });

    this.awardPartyExp(item.expReward, `Picked up ${item.name}`);
    this.revision++;
  }

  private equipInventoryItem(actor: AgentState, item: InventoryItem): void {
    if (item.equippedBy) return;
    item.equippedBy = actor.id;
    actor.equippedItem = item.name;
    if (item.statBonus) {
      actor.stats.atk += item.statBonus.atk || 0;
      actor.stats.def += item.statBonus.def || 0;
      actor.stats.int += item.statBonus.int || 0;
      actor.stats.spd += item.statBonus.spd || 0;
      actor.stats.maxHp += item.statBonus?.maxHp || 0;
      actor.stats.hp = Math.min(actor.stats.maxHp, actor.stats.hp + (item.statBonus?.maxHp || 0));
    }

    this.logEvent('equip', actor.id, `${actor.name} equipped ${item.name}! (ATK ${actor.stats.atk}, SPD ${actor.stats.spd})`, {
      actorId: actor.id,
      itemId: item.id,
      itemName: item.name,
    });
    this.revision++;
  }

  /**
   * Deterministic seeded stat-based combat resolver (no separate battle screen; produces detailed combat event log).
   */
  public resolveStatCombat(enemy: EnemyState): void {
    if (enemy.defeated) return;

    const roundLogs: string[] = [];
    let enemyHp = enemy.stats.hp;
    let round = 1;

    while (enemyHp > 0 && round <= 5) {
      for (const hero of this.actors) {
        const roll = 0.9 + this.nextSeededRandom() * 0.25; // 0.90 .. 1.15 bounded multiplier
        const offensivePower =
          hero.role === 'mage' || hero.role === 'priest'
            ? hero.stats.int * 1.1 + hero.stats.atk * 0.4
            : hero.stats.atk * 1.25;
        const wardBonus = this.quests.wardBlessingActive && enemy.isBoss ? 6 : 0;
        const rawDmg = Math.max(4, Math.round((offensivePower + wardBonus - enemy.stats.def * 0.45) * roll));
        enemyHp = Math.max(0, enemyHp - rawDmg);
        roundLogs.push(`${hero.name} dealt ${rawDmg} dmg`);
        if (enemyHp <= 0) break;
      }

      if (enemyHp > 0) {
        // Enemy counterattacks front-line warrior & random member
        const target = this.actors[round % this.actors.length];
        const wardMitigation = this.quests.wardBlessingActive ? 0.55 : 1.0;
        const enemyDmg = Math.max(
          2,
          Math.round((enemy.stats.atk - target.stats.def * 0.5) * wardMitigation)
        );
        target.stats.hp = Math.max(5, target.stats.hp - enemyDmg);
        roundLogs.push(`${enemy.name} struck ${target.name} for ${enemyDmg} dmg`);
      }
      round++;
    }

    enemy.stats.hp = 0;
    enemy.defeated = true;

    // Priest heals party after combat
    const priest = this.actors.find((a) => a.role === 'priest')!;
    for (const hero of this.actors) {
      hero.stats.hp = Math.min(hero.stats.maxHp, hero.stats.hp + 8);
    }

    const wardNote =
      enemy.isBoss && this.quests.wardBlessingActive
        ? ' [Sacred Ward & Sunsteel Blade decisively weakened the Guardian!]'
        : '';

    this.logEvent(
      'combat',
      'warrior',
      `COMBAT VICTORY: Party defeated ${enemy.name} in ${round} round(s)!${wardNote} (${roundLogs.slice(0, 4).join(', ')})`,
      {
        enemyId: enemy.id,
        enemyName: enemy.name,
        rounds: round,
        wardBlessingActive: this.quests.wardBlessingActive,
        details: roundLogs,
      }
    );

    priest.lastSpeech = `The ${enemy.name} falls! Dawn's grace restores our strength.`;
    priest.lastSpeechAt = Date.now();

    this.awardPartyExp(enemy.expReward, `Defeated ${enemy.name}`);

    if (enemy.id === 'enemy_seal_guardian') {
      this.partyGoal = 'recover_seal';
      this.partyDestination = { ...GOAL_DESTINATIONS.recover_seal };
      this.partyRationale = 'The Obsidian Seal Guardian is vanquished! Claim the Ancient Seal from the altar.';
      for (const a of this.actors) {
        a.partyGoal = 'recover_seal';
      }
    }

    this.revision++;
  }

  private awardPartyExp(amount: number, reason: string): void {
    for (const hero of this.actors) {
      hero.stats.exp += amount;
      // Level thresholds: Level 2 at 60 EXP, Level 3 at 150 EXP
      const targetLevel = hero.stats.exp >= 150 ? 3 : hero.stats.exp >= 60 ? 2 : 1;
      while (hero.stats.level < targetLevel && hero.stats.level < 3) {
        hero.stats.level += 1;
        hero.stats.maxHp += hero.role === 'warrior' ? 8 : 5;
        hero.stats.hp = hero.stats.maxHp;
        hero.stats.atk += hero.role === 'warrior' || hero.role === 'thief' ? 3 : 1;
        hero.stats.def += 2;
        hero.stats.int += hero.role === 'mage' || hero.role === 'priest' ? 4 : 1;
        hero.stats.spd += hero.role === 'thief' ? 3 : 1;

        this.logEvent(
          'level_up',
          hero.id,
          `LEVEL UP! ${hero.name} (${hero.role}) reached Level ${hero.stats.level}! (${reason})`,
          {
            actorId: hero.id,
            level: hero.stats.level,
            stats: { ...hero.stats },
          }
        );
      }
    }
  }

  private getClosestAgent(tile: Tile): AgentState {
    let best = this.actors[0];
    let bestDist = Infinity;
    for (const a of this.actors) {
      const d = tileDistance(tile, a.tile);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  private logEvent(
    kind: WorldEvent['kind'],
    actorId: string | undefined,
    summary: string,
    payload: Record<string, unknown>
  ): void {
    this.revision++;
    this.visibleEvents.unshift({
      id: `evt-${this.revision}-${Date.now()}`,
      at: Date.now(),
      kind,
      actorId,
      summary,
      payload,
    });
    if (this.visibleEvents.length > 40) {
      this.visibleEvents.pop();
    }
  }

  private notifyStateChanged(): void {
    if (this.onStateChanged) {
      this.onStateChanged(this.getSnapshot());
    }
  }

  public getSnapshot(): WorldSnapshot {
    return {
      revision: this.revision,
      roomId: this.roomId,
      paused: this.paused,
      partySpeedMultiplier: this.partySpeedMultiplier,
      partyGoal: this.partyGoal,
      partyDestination: { ...this.partyDestination },
      partyRationale: this.partyRationale,
      actors: this.actors.map((a) => ({
        ...a,
        tile: { ...a.tile },
        stats: { ...a.stats },
        trust: { ...a.trust },
        memories: a.memories.map((m) => ({ ...m })),
      })),
      humans: Array.from(this.humans.values()).map((h) => ({
        ...h,
        tile: { ...h.tile },
      })),
      items: this.items.map((i) => ({ ...i, tile: { ...i.tile } })),
      enemies: this.enemies.map((e) => ({ ...e, tile: { ...e.tile }, stats: { ...e.stats } })),
      pois: this.pois.map((p) => ({ ...p, tile: { ...p.tile } })),
      inventory: this.inventory.map((inv) => ({ ...inv })),
      quests: { ...this.quests },
      visibleEvents: this.visibleEvents.slice(0, 30),
      traces: this.traces.slice(0, 15),
      aiStats: {
        configuredModel: this.geminiService.configuredModel,
        callsUsed: this.aiCallsUsed,
        maxCallsPerRoom: this.geminiService.maxCallsPerRoom,
        lastSource: this.lastAiSource,
        offlineFallbackEnabled: this.geminiService.offlineFallbackEnabled,
      },
    };
  }
}
