import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ClientMessageSchema,
  ClassId,
  ServerMessage,
  WorldSnapshot,
} from '../shared/contracts.js';
import { AuthoritativeGameRoom } from './gameEngine.js';
import { GeminiOrchestratorService } from './geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createAppServer(options?: { tickIntervalMs?: number }) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  const geminiService = new GeminiOrchestratorService();
  const rooms = new Map<string, AuthoritativeGameRoom>();

  function getOrCreateRoom(roomId = 'main-room'): AuthoritativeGameRoom {
    let room = rooms.get(roomId);
    if (!room) {
      room = new AuthoritativeGameRoom(roomId, geminiService, (snapshot) => {
        broadcastDelta(roomId, snapshot);
      });
      rooms.set(roomId, room);
    }
    return room;
  }

  // Initialize default room
  getOrCreateRoom('main-room');

  // Healthcheck for Cloud Run and local verification (/healthz, /health, /api/healthz)
  app.get(['/healthz', '/health', '/api/healthz'], (_req, res) => {
    const mainRoom = getOrCreateRoom('main-room');
    const snap = mainRoom.getSnapshot();
    res.status(200).json({
      status: 'ok',
      service: 'administration-of-the-video-game',
      titleKo: '전자오락관리국',
      revision: snap.revision,
      configuredModel: geminiService.configuredModel,
      aiCallsUsed: snap.aiStats.callsUsed,
      uptimeSec: Math.round(process.uptime()),
    });
  });

  // Server diagnostics (no secrets exposed)
  app.get('/api/diagnostics', (req, res) => {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'main-room';
    const room = getOrCreateRoom(roomId);
    const snap = room.getSnapshot();
    res.json({
      project: 'Administration of the Video Game (전자오락관리국)',
      track: 'Track 1 — Gemini 4 Argon in entertainment',
      roomId,
      revision: snap.revision,
      partyGoal: snap.partyGoal,
      partyDestination: snap.partyDestination,
      partyRationale: snap.partyRationale,
      quests: snap.quests,
      aiConfig: {
        configuredModel: geminiService.configuredModel,
        thinkingLevel: geminiService.thinkingLevel,
        apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
        callsUsed: snap.aiStats.callsUsed,
        maxCallsPerRoom: geminiService.maxCallsPerRoom,
        lastSource: snap.aiStats.lastSource,
        offlineFallbackEnabled: geminiService.offlineFallbackEnabled,
      },
      connectedHumans: snap.humans.filter((h) => h.connected).length,
      tracesCount: snap.traces.length,
      latestTrace: snap.traces[0] || null,
    });
  });

  // Verification traces endpoint for automated testing & judge audit
  app.get('/api/traces', (req, res) => {
    const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'main-room';
    const room = getOrCreateRoom(roomId);
    const snap = room.getSnapshot();
    res.json({
      roomId,
      revision: snap.revision,
      partyGoal: snap.partyGoal,
      traces: snap.traces,
    });
  });

  // REST endpoint for triggering dialogue (useful for curl/automated verification as well as UI)
  app.post('/api/chat', async (req, res) => {
    try {
      const roomId = req.body?.roomId || 'main-room';
      const playerId = req.body?.playerId || 'human-api-1';
      const playerName = req.body?.playerName || 'Bram the Watchman';
      const targetAgentId = req.body?.targetAgentId as ClassId | undefined;
      const text = String(req.body?.text || '').trim();
      const forceOffline = Boolean(req.body?.forceOffline);

      if (!text) {
        res.status(400).json({ error: 'text is required' });
        return;
      }

      const room = getOrCreateRoom(roomId);
      room.addOrUpdateHuman(playerId, playerName);
      const result = await room.handleHumanDialogue(playerId, text, targetAgentId, forceOffline);

      broadcastServerMessage(roomId, {
        version: '1.0',
        requestId: `rest-${Date.now()}`,
        roomId,
        revision: result.snapshot.revision,
        type: 'agent_decision_summary',
        trace: result.trace,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });

  // Reset room state
  app.post('/api/reset', (req, res) => {
    const roomId = req.body?.roomId || 'main-room';
    const room = getOrCreateRoom(roomId);
    const snapshot = room.resetWorld();
    broadcastDelta(roomId, snapshot);
    res.json({ ok: true, snapshot });
  });

  // Advance deterministic ticks via API (for fast-forward verification)
  app.post('/api/tick', (req, res) => {
    const roomId = req.body?.roomId || 'main-room';
    const steps = Math.max(1, Math.min(50, Number(req.body?.steps) || 1));
    const room = getOrCreateRoom(roomId);
    for (let i = 0; i < steps; i++) {
      room.stepPartyTowardDestination();
    }
    const snapshot = room.getSnapshot();
    broadcastDelta(roomId, snapshot);
    res.json({ ok: true, steps, snapshot });
  });

  // Serve built static client in production / single-port mode
  const clientDistPath = path.resolve(__dirname, '../../dist/client');
  const publicAssetsPath = path.resolve(__dirname, '../../public');
  if (fs.existsSync(publicAssetsPath)) {
    app.use('/assets', express.static(path.join(publicAssetsPath, 'assets')));
  }
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path === '/healthz' ||
        req.path === '/health' ||
        req.path.startsWith('/ws')
      ) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  interface ClientMeta {
    ws: WebSocket;
    roomId: string;
    playerId: string;
    lastChatAt: number;
  }

  const clients = new Map<WebSocket, ClientMeta>();

  function sendMessage(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcastServerMessage(roomId: string, msg: ServerMessage): void {
    for (const meta of clients.values()) {
      if (meta.roomId === roomId) {
        sendMessage(meta.ws, msg);
      }
    }
  }

  function broadcastDelta(roomId: string, snapshot: WorldSnapshot, requestId = 'server-tick'): void {
    broadcastServerMessage(roomId, {
      version: '1.0',
      requestId,
      roomId,
      revision: snapshot.revision,
      type: 'world_delta',
      snapshot,
    });
  }

  wss.on('connection', (ws) => {
    const defaultPlayerId = `human-${Math.random().toString(36).slice(2, 8)}`;
    const meta: ClientMeta = {
      ws,
      roomId: 'main-room',
      playerId: defaultPlayerId,
      lastChatAt: 0,
    };
    clients.set(ws, meta);

    ws.on('message', async (rawBuffer) => {
      let rawObj: unknown;
      try {
        rawObj = JSON.parse(rawBuffer.toString());
      } catch {
        sendMessage(ws, {
          version: '1.0',
          requestId: 'invalid-json',
          roomId: meta.roomId,
          revision: 0,
          type: 'error',
          code: 'INVALID_JSON',
          message: 'Payload must be valid JSON',
        });
        return;
      }

      const parsed = ClientMessageSchema.safeParse(rawObj);
      if (!parsed.success) {
        sendMessage(ws, {
          version: '1.0',
          requestId: 'schema-error',
          roomId: meta.roomId,
          revision: 0,
          type: 'error',
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid client message schema',
        });
        return;
      }

      const msg = parsed.data;
      meta.roomId = msg.roomId || 'main-room';
      const room = getOrCreateRoom(meta.roomId);

      switch (msg.type) {
        case 'join_room': {
          if (msg.playerId) {
            meta.playerId = msg.playerId;
          }
          const preJoinSnap = room.getSnapshot();
          const otherConnected = preJoinSnap.humans.some(
            (h) => h.connected && h.id !== meta.playerId
          );
          if (!otherConnected && preJoinSnap.quests.questComplete) {
            room.resetWorld();
          }
          room.addOrUpdateHuman(meta.playerId, msg.playerName, msg.roleTitle);
          const snapshot = room.getSnapshot();
          sendMessage(ws, {
            version: '1.0',
            requestId: msg.requestId,
            roomId: meta.roomId,
            revision: snapshot.revision,
            type: 'room_snapshot',
            youId: meta.playerId,
            snapshot,
          });
          broadcastDelta(meta.roomId, snapshot, msg.requestId);
          break;
        }

        case 'move_input': {
          room.moveHuman(meta.playerId, msg.direction, msg.targetTile);
          const snapshot = room.getSnapshot();
          broadcastDelta(meta.roomId, snapshot, msg.requestId);
          break;
        }

        case 'interact': {
          const interaction = room.handleHumanInteract(meta.playerId, msg.targetId);
          const snapshot = room.getSnapshot();
          broadcastServerMessage(meta.roomId, {
            version: '1.0',
            requestId: msg.requestId,
            roomId: meta.roomId,
            revision: snapshot.revision,
            type: 'dialogue',
            speakerId: interaction.targetId,
            speakerName: interaction.targetName,
            speakerKind: 'agent',
            targetId: meta.playerId,
            text: interaction.message,
            at: Date.now(),
          });
          broadcastDelta(meta.roomId, snapshot, msg.requestId);
          break;
        }

        case 'chat_message': {
          const now = Date.now();
          if (now - meta.lastChatAt < 600) {
            sendMessage(ws, {
              version: '1.0',
              requestId: msg.requestId,
              roomId: meta.roomId,
              revision: room.getSnapshot().revision,
              type: 'error',
              code: 'RATE_LIMIT',
              message: 'Please wait a moment before sending another message.',
            });
            return;
          }
          meta.lastChatAt = now;

          const human = room.addOrUpdateHuman(meta.playerId);
          broadcastServerMessage(meta.roomId, {
            version: '1.0',
            requestId: msg.requestId,
            roomId: meta.roomId,
            revision: room.getSnapshot().revision,
            type: 'dialogue',
            speakerId: human.id,
            speakerName: human.name,
            speakerKind: 'human',
            targetId: msg.targetAgentId,
            text: msg.text,
            at: now,
          });

          const { trace, snapshot } = await room.handleHumanDialogue(
            meta.playerId,
            msg.text,
            msg.targetAgentId
          );

          const addressed = snapshot.actors.find((a) => a.id === trace.addressedAgentId)!;
          broadcastServerMessage(meta.roomId, {
            version: '1.0',
            requestId: msg.requestId,
            roomId: meta.roomId,
            revision: snapshot.revision,
            type: 'dialogue',
            speakerId: addressed.id,
            speakerName: addressed.name,
            speakerKind: 'agent',
            targetId: human.id,
            text: addressed.lastSpeech || '',
            at: Date.now(),
          });

          broadcastServerMessage(meta.roomId, {
            version: '1.0',
            requestId: msg.requestId,
            roomId: meta.roomId,
            revision: snapshot.revision,
            type: 'agent_decision_summary',
            trace,
          });

          broadcastDelta(meta.roomId, snapshot, msg.requestId);
          break;
        }

        case 'control_room': {
          if (msg.action === 'reset') {
            const snapshot = room.resetWorld();
            broadcastDelta(meta.roomId, snapshot, msg.requestId);
          } else if (msg.action === 'toggle_pause') {
            room.togglePause();
            broadcastDelta(meta.roomId, room.getSnapshot(), msg.requestId);
          } else if (msg.action === 'teleport_near_party') {
            room.teleportHumanNearParty(meta.playerId);
            broadcastDelta(meta.roomId, room.getSnapshot(), msg.requestId);
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      const m = clients.get(ws);
      if (m) {
        const room = rooms.get(m.roomId);
        if (room) {
          room.removeHuman(m.playerId);
          broadcastDelta(m.roomId, room.getSnapshot());
        }
        clients.delete(ws);
      }
    });
  });

  const tickIntervalMs = options?.tickIntervalMs ?? 1200;
  const tickTimer = setInterval(() => {
    for (const [roomId, room] of rooms.entries()) {
      const hasActiveClients = Array.from(clients.values()).some((c) => c.roomId === roomId);
      if (hasActiveClients) {
        room.tick();
      }
    }
  }, tickIntervalMs);

  const shutdown = () => {
    clearInterval(tickTimer);
    for (const client of wss.clients) {
      client.close();
    }
    server.close();
  };

  return { app, server, wss, rooms, getOrCreateRoom, shutdown };
}

// Start server if executed directly
const isMain =
  process.argv[1] &&
  (path.resolve(process.argv[1]) === path.resolve(__filename) ||
    process.argv[1].endsWith('src/server/index.ts') ||
    process.argv[1].endsWith('src\\server\\index.ts') ||
    process.argv[1].endsWith('dist/server/index.js') ||
    process.argv[1].endsWith('dist\\server\\index.js'));

if (isMain) {
  const port = Number(process.env.PORT) || 8080;
  const { server, shutdown } = createAppServer();

  server.listen(port, '0.0.0.0', () => {
    console.log(
      `[Administration of the Video Game | 전자오락관리국] Server listening on http://0.0.0.0:${port}`
    );
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    shutdown();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    shutdown();
    process.exit(0);
  });
}
