import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { createAppServer } from '../../src/server/index.js';
import type { ServerMessage, WorldSnapshot } from '../../src/shared/contracts.js';

function waitForSnapshot(
  ws: WebSocket,
  predicate: (snap: WorldSnapshot) => boolean,
  timeoutMs = 25000,
): Promise<WorldSnapshot> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('Timed out waiting for matching WorldSnapshot'));
    }, timeoutMs);

    const onMessage = (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as ServerMessage;
        if (
          (msg.type === 'room_snapshot' || msg.type === 'world_delta') &&
          predicate(msg.snapshot)
        ) {
          clearTimeout(timer);
          ws.off('message', onMessage);
          resolve(msg.snapshot);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.on('message', onMessage);
  });
}

describe('Two-Session WebSocket Multiplayer & Production Bundle Security', () => {
  let serverInstance: ReturnType<typeof createAppServer>;
  let baseUrl = '';
  let wsUrl = '';

  beforeAll(async () => {
    serverInstance = createAppServer({ tickIntervalMs: 5000 });
    await new Promise<void>((resolve) => {
      serverInstance.server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = serverInstance.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    wsUrl = `ws://127.0.0.1:${addr.port}/ws`;
  });

  afterAll(() => {
    serverInstance.shutdown();
  });

  it('exposes /healthz and /api/diagnostics with zero secret leakage', async () => {
    const healthRes = await fetch(`${baseUrl}/healthz`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe('ok');
    expect(health.configuredModel).toBeTruthy();
    expect(JSON.stringify(health)).not.toContain('AIza');

    const diagRes = await fetch(`${baseUrl}/api/diagnostics`);
    expect(diagRes.status).toBe(200);
    const diag = await diagRes.json();
    expect(diag.roomId).toBe('main-room');
    expect(JSON.stringify(diag)).not.toContain('AIza');
  });

  it('synchronizes two simultaneous browser WebSocket sessions, WASD movement, and AI party route change', async () => {
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);

    await Promise.all([
      new Promise<void>((res) => ws1.once('open', () => res())),
      new Promise<void>((res) => ws2.once('open', () => res())),
    ]);

    const bothJoinedPromise = waitForSnapshot(
      ws2,
      (snap) =>
        snap.humans.some((p) => p.name === 'Clerk Hana') &&
        snap.humans.some((p) => p.name === 'Watchman Jin'),
    );

    ws1.send(
      JSON.stringify({
        version: '1.0',
        requestId: 'join-1',
        roomId: 'main-room',
        type: 'join_room',
        playerName: 'Clerk Hana',
        roleTitle: 'Town Clerk',
      }),
    );

    ws2.send(
      JSON.stringify({
        version: '1.0',
        requestId: 'join-2',
        roomId: 'main-room',
        type: 'join_room',
        playerName: 'Watchman Jin',
        roleTitle: 'Bridge Watchman',
      }),
    );

    const joinedSnap = await bothJoinedPromise;
    expect(joinedSnap.humans.length).toBeGreaterThanOrEqual(2);

    const hanaBefore = joinedSnap.humans.find((p) => p.name === 'Clerk Hana')!;
    expect(hanaBefore).toBeDefined();

    // Session 1 moves East ('right') and Session 2 observes the authoritative movement
    const movedPromise = waitForSnapshot(ws2, (snap) => {
      const hana = snap.humans.find((p) => p.name === 'Clerk Hana');
      return Boolean(hana && hana.tile.x === hanaBefore.tile.x + 1);
    });

    ws1.send(
      JSON.stringify({
        version: '1.0',
        requestId: 'move-1',
        roomId: 'main-room',
        type: 'move_input',
        direction: 'right',
      }),
    );

    const movedSnap = await movedPromise;
    const hanaAfter = movedSnap.humans.find((p) => p.name === 'Clerk Hana')!;
    expect(hanaAfter.tile.x).toBe(hanaBefore.tile.x + 1);

    // Session 1 speaks a truthful clue about the East Storehouse
    const routeChangedPromise = waitForSnapshot(
      ws2,
      (snap) => snap.partyGoal === 'investigate_storehouse' && snap.traces.length > 0,
      30000,
    );

    ws1.send(
      JSON.stringify({
        version: '1.0',
        requestId: 'chat-1',
        roomId: 'main-room',
        type: 'chat_message',
        text: 'Wait! The East Storehouse at (5,4) holds the Sunsteel Blade and Sacred Ward Scroll to break the Guardian shield!',
      }),
    );

    const routeSnap = await routeChangedPromise;
    expect(routeSnap.partyGoal).toBe('investigate_storehouse');
    expect(routeSnap.partyDestination).toMatchObject({ x: 5, y: 4 });
    expect(routeSnap.traces[0].newPartyGoal).toBe('investigate_storehouse');
    expect(routeSnap.traces[0].routeChanged).toBe(true);

    ws1.close();
    ws2.close();
  }, 35000);

  it('verifies built client bundle contains no GEMINI_API_KEY or secret values', () => {
    const distClientDir = path.resolve(process.cwd(), 'dist/client');
    expect(fs.existsSync(distClientDir)).toBe(true);

    const checkDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toContain('AIzaSy');
          if (process.env.GEMINI_API_KEY) {
            expect(content).not.toContain(process.env.GEMINI_API_KEY);
          }
        }
      }
    };

    checkDir(distClientDir);
  });
});
