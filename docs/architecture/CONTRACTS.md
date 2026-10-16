# Domain and tool contracts — v0.0

## Canonical entities (TypeScript sketch)
```ts
type ActorId = string;
type Tile = { x: number; y: number; zone: string };
type ClassId = 'warrior' | 'mage' | 'thief' | 'priest';
type Stats = { level: number; exp: number; hp: number; maxHp: number; atk: number; def: number; int: number; spd: number };
type Memory = { id: string; subjectId: string; claim: string; sourceActorId: string; confidence: number; verified: boolean | null; observedAt: number };
type AgentState = { id: ActorId; role: ClassId; tile: Tile; stats: Stats; personalGoal: string; partyGoal: string; trust: Record<ActorId, number>; memories: Memory[] };
type WorldSnapshot = { revision: number; actors: AgentState[]; quests: Record<string, boolean>; visibleEvents: WorldEvent[] };
type WorldEvent = { id: string; at: number; kind: string; actorId?: string; payload: Record<string, unknown> };
```

## Allowed high-level intents
```ts
type Intent =
  | { type: 'move'; actorId: string; destination: Tile; reasonCode: string }
  | { type: 'talk'; actorId: string; targetId: string; text: string }
  | { type: 'interact'; actorId: string; targetId: string }
  | { type: 'pickup'; actorId: string; itemId: string }
  | { type: 'equip'; actorId: string; itemId: string }
  | { type: 'attack'; actorId: string; targetId: string }
  | { type: 'wait'; actorId: string; durationMs: number };
```
Use Zod (or equivalent) at runtime for strict validation. `reasonCode` is a short auditable label, not hidden reasoning.

## Server protocol (draft)
Client → server: `join_room`, `move_input`, `interact`, `chat_message`.
Server → client: `room_snapshot`, `world_delta`, `dialogue`, `agent_decision_summary`, `error`.
Every message has `version`, `requestId`, `roomId`; deltas include monotonic `revision`.

## Acceptance invariants
No walking through blocked tiles, no two owners for one item, no stat mutation by chat, no fabricated evidence auto-promoted to truth, no NPC responding to remote human without intended communication channel, no party goal conflicting with quest state.
