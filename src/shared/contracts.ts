import { z } from 'zod';

export type ActorId = string;
export type ZoneId = 'village' | 'crossroads' | 'cave';

export const ZoneIdSchema = z.enum(['village', 'crossroads', 'cave']);

export const TileSchema = z.object({
  x: z.number().int().min(0).max(31),
  y: z.number().int().min(0).max(21),
  zone: ZoneIdSchema,
});
export type Tile = z.infer<typeof TileSchema>;

export const ClassIdSchema = z.enum(['warrior', 'mage', 'thief', 'priest']);
export type ClassId = z.infer<typeof ClassIdSchema>;

export const PartyGoalIdSchema = z.enum([
  'march_to_cave',
  'investigate_storehouse',
  'investigate_marsh',
  'defeat_guardian',
  'recover_seal',
  'celebrate_victory',
]);
export type PartyGoalId = z.infer<typeof PartyGoalIdSchema>;

export interface Stats {
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  int: number;
  spd: number;
}

export interface Memory {
  id: string;
  subjectId: string;
  claim: string;
  topic: 'storehouse_clue' | 'marsh_rumor' | 'cave_danger' | 'general';
  sourceActorId: string;
  confidence: number; // 0.0 to 1.0
  verified: boolean | null; // null = unverified claim, true = verified fact, false = disproven lie
  observedAt: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  kind: 'coin' | 'healing' | 'weapon' | 'clue' | 'relic';
  description: string;
  statBonus?: Partial<Pick<Stats, 'atk' | 'def' | 'int' | 'spd' | 'maxHp'>>;
  equippedBy?: ClassId;
}

export interface AgentState {
  id: ClassId;
  name: string;
  title: string;
  role: ClassId;
  tile: Tile;
  facing: 'up' | 'down' | 'left' | 'right';
  stats: Stats;
  personalGoal: string;
  partyGoal: PartyGoalId;
  goalPreference: PartyGoalId;
  trust: Record<ActorId, number>; // -100 to 100
  memories: Memory[];
  equippedItem?: string;
  lastSpeech?: string;
  lastSpeechAt?: number;
  thinking?: boolean;
}

export interface HumanPlayerState {
  id: ActorId;
  name: string;
  roleTitle: string;
  spriteVariant: number;
  tile: Tile;
  facing: 'up' | 'down' | 'left' | 'right';
  lastSpeech?: string;
  lastSpeechAt?: number;
  connected: boolean;
}

export interface WorldItemState {
  id: string;
  name: string;
  kind: 'coin' | 'healing' | 'weapon' | 'clue' | 'relic';
  tile: Tile;
  pickedUp: boolean;
  pickedUpBy?: ActorId;
  description: string;
  expReward: number;
  statBonus?: Partial<Pick<Stats, 'atk' | 'def' | 'int' | 'spd' | 'maxHp'>>;
}

export interface EnemyState {
  id: string;
  name: string;
  tile: Tile;
  stats: Stats;
  defeated: boolean;
  isBoss: boolean;
  expReward: number;
}

export interface PointOfInterest {
  id: string;
  name: string;
  tile: Tile;
  description: string;
  inspected: boolean;
}

export interface QuestFlags {
  sealQuestKnown: boolean;
  storehouseInvestigated: boolean;
  caveVisited: boolean;
  sealRecovered: boolean;
  rumorSuspected: boolean;
  questComplete: boolean;
  wardBlessingActive: boolean;
}

export const IntentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('move'),
    actorId: z.string().min(1),
    destination: TileSchema,
    reasonCode: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal('talk'),
    actorId: z.string().min(1),
    targetId: z.string().min(1),
    text: z.string().min(1).max(280),
  }),
  z.object({
    type: z.literal('interact'),
    actorId: z.string().min(1),
    targetId: z.string().min(1),
  }),
  z.object({
    type: z.literal('pickup'),
    actorId: z.string().min(1),
    itemId: z.string().min(1),
  }),
  z.object({
    type: z.literal('equip'),
    actorId: z.string().min(1),
    itemId: z.string().min(1),
  }),
  z.object({
    type: z.literal('attack'),
    actorId: z.string().min(1),
    targetId: z.string().min(1),
  }),
  z.object({
    type: z.literal('wait'),
    actorId: z.string().min(1),
    durationMs: z.number().int().min(100).max(10000),
  }),
]);
export type Intent = z.infer<typeof IntentSchema>;

export const BeliefUpdateProposalSchema = z.object({
  claim: z.string().min(3).max(200),
  topic: z.enum(['storehouse_clue', 'marsh_rumor', 'cave_danger', 'general']),
  confidenceDelta: z.number().min(-0.8).max(0.95),
  sourceActorId: z.string().min(1),
});
export type BeliefUpdateProposal = z.infer<typeof BeliefUpdateProposalSchema>;

export const PartyReactionSchema = z.object({
  actorId: ClassIdSchema,
  speech: z.string().min(1).max(220),
  voteGoal: PartyGoalIdSchema,
  reason: z.string().min(1).max(160),
});
export type PartyReaction = z.infer<typeof PartyReactionSchema>;

export const CoordinatorDecisionSchema = z.object({
  chosenGoal: PartyGoalIdSchema,
  rationale: z.string().min(1).max(240),
  consensusType: z.enum(['unanimous', 'majority', 'leader_tiebreak']),
});
export type CoordinatorDecision = z.infer<typeof CoordinatorDecisionSchema>;

export const AgentDecisionEnvelopeSchema = z.object({
  speech: z.string().min(1).max(260),
  beliefUpdates: z.array(BeliefUpdateProposalSchema).max(3).default([]),
  trustDelta: z.number().int().min(-40).max(35).default(0),
  goalPreference: PartyGoalIdSchema,
  proposedIntent: IntentSchema,
  reasonCode: z.string().min(1).max(64),
  partyReactions: z.array(PartyReactionSchema).max(4).optional(),
  coordinatorDecision: CoordinatorDecisionSchema.optional(),
});
export type AgentDecisionEnvelope = z.infer<typeof AgentDecisionEnvelopeSchema>;

export interface WorldEvent {
  id: string;
  at: number;
  kind:
    | 'speech'
    | 'movement'
    | 'belief_update'
    | 'party_decision'
    | 'item_pickup'
    | 'equip'
    | 'combat'
    | 'level_up'
    | 'verification'
    | 'quest_flag'
    | 'security_block';
  actorId?: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface VerificationTrace {
  traceId: string;
  timestamp: number;
  trigger: string;
  speakerId?: string;
  speakerName?: string;
  utterance?: string;
  addressedAgentId: ClassId;
  modelId: string;
  source: 'gemini-4-argon' | 'offline_fallback' | 'security_gate';
  latencyMs: number;
  promptInjectionBlocked: boolean;
  rawProposalSummary: string;
  schemaValid: boolean;
  rulesGateValid: boolean;
  rejectionReason?: string;
  beliefUpdateSummary: string;
  trustChange?: {
    agentId: ClassId;
    humanId: string;
    previous: number;
    next: number;
  };
  partyVotes: Record<ClassId, PartyGoalId>;
  previousPartyGoal: PartyGoalId;
  newPartyGoal: PartyGoalId;
  routeChanged: boolean;
  executedIntent: Intent;
  resultingRevision: number;
  causalChain: {
    humanInput: string;
    beliefUpdate: string;
    partyDeliberation: string;
    worldAction: string;
  };
}

export interface WorldSnapshot {
  revision: number;
  roomId: string;
  paused: boolean;
  partySpeedMultiplier: number;
  partyGoal: PartyGoalId;
  partyDestination: Tile;
  partyRationale: string;
  actors: AgentState[];
  humans: HumanPlayerState[];
  items: WorldItemState[];
  enemies: EnemyState[];
  pois: PointOfInterest[];
  inventory: InventoryItem[];
  quests: QuestFlags;
  visibleEvents: WorldEvent[];
  traces: VerificationTrace[];
  aiStats: {
    configuredModel: string;
    callsUsed: number;
    maxCallsPerRoom: number;
    lastSource: 'gemini-4-argon' | 'offline_fallback' | 'security_gate' | 'idle';
    offlineFallbackEnabled: boolean;
  };
}

// Client -> Server WebSocket Messages
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    version: z.literal('1.0').default('1.0'),
    requestId: z.string().min(1),
    roomId: z.string().default('main-room'),
    type: z.literal('join_room'),
    playerName: z.string().min(1).max(32).optional(),
    roleTitle: z.string().min(1).max(40).optional(),
    playerId: z.string().min(1).max(64).optional(),
  }),
  z.object({
    version: z.literal('1.0').default('1.0'),
    requestId: z.string().min(1),
    roomId: z.string().default('main-room'),
    type: z.literal('move_input'),
    direction: z.enum(['up', 'down', 'left', 'right']).optional(),
    targetTile: TileSchema.optional(),
  }),
  z.object({
    version: z.literal('1.0').default('1.0'),
    requestId: z.string().min(1),
    roomId: z.string().default('main-room'),
    type: z.literal('interact'),
    targetId: z.string().optional(),
  }),
  z.object({
    version: z.literal('1.0').default('1.0'),
    requestId: z.string().min(1),
    roomId: z.string().default('main-room'),
    type: z.literal('chat_message'),
    targetAgentId: ClassIdSchema.optional(),
    text: z.string().min(1).max(280),
  }),
  z.object({
    version: z.literal('1.0').default('1.0'),
    requestId: z.string().min(1),
    roomId: z.string().default('main-room'),
    type: z.literal('control_room'),
    action: z.enum(['reset', 'toggle_pause', 'teleport_near_party']),
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client WebSocket Messages
export type ServerMessage =
  | {
      version: '1.0';
      requestId: string;
      roomId: string;
      revision: number;
      type: 'room_snapshot';
      youId: ActorId;
      snapshot: WorldSnapshot;
    }
  | {
      version: '1.0';
      requestId: string;
      roomId: string;
      revision: number;
      type: 'world_delta';
      snapshot: WorldSnapshot;
    }
  | {
      version: '1.0';
      requestId: string;
      roomId: string;
      revision: number;
      type: 'dialogue';
      speakerId: string;
      speakerName: string;
      speakerKind: 'human' | 'agent' | 'system';
      targetId?: string;
      text: string;
      at: number;
    }
  | {
      version: '1.0';
      requestId: string;
      roomId: string;
      revision: number;
      type: 'agent_decision_summary';
      trace: VerificationTrace;
    }
  | {
      version: '1.0';
      requestId: string;
      roomId: string;
      revision: number;
      type: 'error';
      code: string;
      message: string;
    };
