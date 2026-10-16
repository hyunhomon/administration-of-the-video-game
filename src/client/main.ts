import Phaser from 'phaser';
import {
  ClassId,
  ClientMessage,
  ServerMessage,
  Tile,
  VerificationTrace,
  WorldSnapshot,
} from '../shared/contracts.js';
import { GOAL_LABELS, MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from '../shared/worldMap.js';
import { RpgWorldScene } from './gameScene.js';
import { RetroSoundEngine } from './audio.js';

const sound = new RetroSoundEngine();

let ws: WebSocket | null = null;
let myPlayerId: string | null = sessionStorage.getItem('rpg_player_id');
if (!myPlayerId) {
  myPlayerId = `human-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem('rpg_player_id', myPlayerId);
}

let latestSnapshot: WorldSnapshot | null = null;
let worldScene: RpgWorldScene | null = null;
let previousGoal: string | null = null;
let previousLevelSum = 4;

function sendWsMessage(msg: ClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function connectWebSocket(): void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
    const nameInput = document.getElementById('player-name-input') as HTMLInputElement | null;
    sendWsMessage({
      version: '1.0',
      requestId: `join-${Date.now()}`,
      roomId: 'main-room',
      type: 'join_room',
      playerId: myPlayerId!,
      playerName: nameInput?.value || 'Mira the Herbalist',
    });
  });

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data) as ServerMessage;
      handleServerMessage(msg);
    } catch (err) {
      console.error('Failed to parse server message:', err);
    }
  });

  ws.addEventListener('close', () => {
    setTimeout(connectWebSocket, 1500);
  });
}

function handleServerMessage(msg: ServerMessage): void {
  if (msg.type === 'room_snapshot') {
    myPlayerId = msg.youId;
    applySnapshot(msg.snapshot);
  } else if (msg.type === 'world_delta') {
    applySnapshot(msg.snapshot);
  } else if (msg.type === 'dialogue') {
    sound.playSpeech();
  } else if (msg.type === 'agent_decision_summary') {
    renderLatestTraceCausalChain(msg.trace);
    if (msg.trace.routeChanged) {
      sound.playRouteChange();
    } else if (msg.trace.promptInjectionBlocked) {
      sound.playAlert();
    }
  }
}

function applySnapshot(snapshot: WorldSnapshot): void {
  latestSnapshot = snapshot;

  // Check for route change or level up sound cues
  if (previousGoal && previousGoal !== snapshot.partyGoal) {
    sound.playRouteChange();
  }
  previousGoal = snapshot.partyGoal;

  const levelSum = snapshot.actors.reduce((acc, a) => acc + a.stats.level, 0);
  if (levelSum > previousLevelSum) {
    sound.playLevelUp();
  }
  previousLevelSum = levelSum;

  if (worldScene) {
    worldScene.syncSnapshot(snapshot, myPlayerId);
  }

  updateHeaderAndHud(snapshot);
  updateQuestAndInventory(snapshot);
  updateAgentsGrid(snapshot);
  updateEventsAndTraces(snapshot);

  if (snapshot.traces.length > 0) {
    renderLatestTraceCausalChain(snapshot.traces[0]);
  }
}

function updateHeaderAndHud(snapshot: WorldSnapshot): void {
  const modelLabel = document.getElementById('model-label');
  const callsLabel = document.getElementById('calls-label');
  const playersLabel = document.getElementById('players-label');
  const revLabel = document.getElementById('rev-label');
  const routeIndicator = document.getElementById('route-indicator');
  const pauseBtn = document.getElementById('btn-pause');

  if (modelLabel) {
    const srcTag =
      snapshot.aiStats.lastSource === 'gemini-4-argon'
        ? 'LIVE API'
        : snapshot.aiStats.lastSource === 'offline_fallback'
        ? 'FALLBACK'
        : snapshot.aiStats.lastSource === 'security_gate'
        ? 'SECURITY GATE'
        : 'READY';
    modelLabel.textContent = `Model: ${snapshot.aiStats.configuredModel} (${srcTag})`;
  }
  if (callsLabel) {
    callsLabel.textContent = `AI Calls: ${snapshot.aiStats.callsUsed}/${snapshot.aiStats.maxCallsPerRoom}`;
  }
  if (playersLabel) {
    const activeHumans = snapshot.humans.filter((h) => h.connected).length;
    playersLabel.textContent = `NPC Players: ${activeHumans}`;
  }
  if (revLabel) {
    revLabel.textContent = `Rev #${snapshot.revision}`;
  }
  if (routeIndicator) {
    routeIndicator.textContent = `Active Route: ${GOAL_LABELS[snapshot.partyGoal]} → (${snapshot.partyDestination.x}, ${snapshot.partyDestination.y})`;
  }
  if (pauseBtn) {
    pauseBtn.textContent = snapshot.paused ? '▶️ Resume Walk' : '⏸️ Pause Walk';
  }
}

function renderLatestTraceCausalChain(trace: VerificationTrace): void {
  const badge = document.getElementById('trace-source-badge');
  const stepInput = document.getElementById('causal-input');
  const stepBelief = document.getElementById('causal-belief');
  const stepDelib = document.getElementById('causal-deliberation');
  const stepAction = document.getElementById('causal-action');

  if (badge) {
    if (trace.source === 'gemini-4-argon') {
      badge.className = 'badge badge-green';
      badge.textContent = `LIVE ${trace.modelId} (${trace.latencyMs}ms)`;
    } else if (trace.source === 'security_gate') {
      badge.className = 'badge badge-red';
      badge.textContent = `SECURITY BLOCKED (${trace.latencyMs}ms)`;
    } else {
      badge.className = 'badge badge-gold';
      badge.textContent = `DETERMINISTIC FALLBACK (${trace.latencyMs}ms)`;
    }
  }

  if (stepInput) stepInput.textContent = trace.causalChain.humanInput;
  if (stepBelief) stepBelief.textContent = trace.causalChain.beliefUpdate;
  if (stepDelib) stepDelib.textContent = trace.causalChain.partyDeliberation;
  if (stepAction) stepAction.textContent = trace.causalChain.worldAction;
}

function updateQuestAndInventory(snapshot: WorldSnapshot): void {
  const goalBadge = document.getElementById('quest-goal-badge');
  const rationaleEl = document.getElementById('party-rationale-text');
  const flagsRow = document.getElementById('quest-flags-row');
  const invRow = document.getElementById('inventory-row');

  if (goalBadge) {
    goalBadge.textContent = snapshot.partyGoal;
    goalBadge.className =
      snapshot.partyGoal === 'investigate_storehouse'
        ? 'badge badge-green'
        : snapshot.partyGoal === 'investigate_marsh'
        ? 'badge badge-red'
        : 'badge badge-gold';
  }
  if (rationaleEl) {
    rationaleEl.textContent = snapshot.partyRationale;
  }

  if (flagsRow) {
    const flags = [
      { key: 'sealQuestKnown', label: 'Seal Quest Known', on: snapshot.quests.sealQuestKnown },
      {
        key: 'storehouseInvestigated',
        label: 'Storehouse Verified ✓',
        on: snapshot.quests.storehouseInvestigated,
      },
      {
        key: 'wardBlessingActive',
        label: 'Sacred Ward Active 🛡️',
        on: snapshot.quests.wardBlessingActive,
      },
      {
        key: 'rumorSuspected',
        label: 'Marsh Rumor Disproven ✗',
        on: snapshot.quests.rumorSuspected,
        warn: true,
      },
      { key: 'caveVisited', label: 'Cave Entered', on: snapshot.quests.caveVisited },
      { key: 'sealRecovered', label: 'Ancient Seal Recovered 🏆', on: snapshot.quests.sealRecovered },
      { key: 'questComplete', label: 'Quest Complete', on: snapshot.quests.questComplete },
    ];

    flagsRow.innerHTML = flags
      .map(
        (f) =>
          `<span class="flag-pill ${f.on ? (f.warn ? 'flag-warn' : 'flag-on') : ''}" data-flag="${f.key}">${
            f.on ? '● ' : '○ '
          }${f.label}</span>`
      )
      .join('');
  }

  if (invRow) {
    if (snapshot.inventory.length === 0) {
      invRow.innerHTML = `<span class="sub-hint">Party Inventory: (Empty — items picked up along route appear here)</span>`;
    } else {
      invRow.innerHTML = snapshot.inventory
        .map(
          (item) =>
            `<span class="inv-item" title="${escapeHtml(item.description)}">🎒 ${escapeHtml(item.name)}${
              item.equippedBy ? ` [Equipped: ${item.equippedBy}]` : ''
            }</span>`
        )
        .join('');
    }
  }
}

function updateAgentsGrid(snapshot: WorldSnapshot): void {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;

  grid.innerHTML = snapshot.actors
    .map((agent) => {
      const myTrust = myPlayerId && agent.trust[myPlayerId] !== undefined ? agent.trust[myPlayerId] : 0;
      const latestMem = agent.memories[agent.memories.length - 1];
      const memStatusClass =
        latestMem?.verified === true
          ? 'mem-verified-true'
          : latestMem?.verified === false
          ? 'mem-verified-false'
          : '';
      const memBadge =
        latestMem?.verified === true
          ? '[VERIFIED TRUE ✓]'
          : latestMem?.verified === false
          ? '[DISPROVEN LIE ✗]'
          : '[UNVERIFIED CLAIM]';

      return `
        <div class="agent-card" data-agent-card="${agent.id}">
          <div class="agent-card-top">
            <span class="agent-name">${escapeHtml(agent.name)} ${agent.thinking ? '💭' : ''}</span>
            <span class="agent-role-tag">${agent.role} · Lv.${agent.stats.level} (${agent.stats.exp} XP)</span>
          </div>
          <div class="agent-stats-line">
            <span>❤️ HP ${agent.stats.hp}/${agent.stats.maxHp}</span>
            <span>⚔️ ATK ${agent.stats.atk} · 🛡️ DEF ${agent.stats.def} · 🔮 INT ${agent.stats.int}</span>
          </div>
          <div class="agent-meta-line">
            <span>Vote: <strong style="color:#38bdf8">${agent.goalPreference}</strong></span>
            <span>Trust in You: <strong style="color:${
              myTrust > 0 ? '#34d399' : myTrust < 0 ? '#f87171' : '#cbd5e1'
            }">${myTrust >= 0 ? '+' : ''}${myTrust}</strong></span>
          </div>
          ${
            agent.equippedItem
              ? `<div class="agent-meta-line"><span style="color:#fde68a">🗡️ Equipped: ${escapeHtml(
                  agent.equippedItem
                )}</span></div>`
              : ''
          }
          <div class="agent-speech-box">
            "${escapeHtml(agent.lastSpeech || 'Ready to march.')}"
          </div>
          ${
            latestMem
              ? `<div class="memory-item ${memStatusClass}">
                  <strong>Memory ${memBadge}:</strong> ${escapeHtml(latestMem.claim)}
                </div>`
              : ''
          }
        </div>
      `;
    })
    .join('');
}

function updateEventsAndTraces(snapshot: WorldSnapshot): void {
  const eventList = document.getElementById('event-list');
  const traceList = document.getElementById('trace-list');
  const traceCount = document.getElementById('trace-count');

  if (traceCount) {
    traceCount.textContent = String(snapshot.traces.length);
  }

  if (eventList) {
    eventList.innerHTML = snapshot.visibleEvents
      .slice(0, 20)
      .map(
        (ev) => `
        <div class="event-row kind-${ev.kind}">
          <strong>[${ev.kind.toUpperCase()}]</strong> ${escapeHtml(ev.summary)}
        </div>
      `
      )
      .join('');
  }

  if (traceList) {
    if (snapshot.traces.length === 0) {
      traceList.innerHTML = `<div class="trace-row">No dialogue verification traces yet. Speak to a hero to generate a trace.</div>`;
    } else {
      traceList.innerHTML = snapshot.traces
        .map(
          (t) => `
          <div class="trace-row" data-trace-id="${t.traceId}">
            <div>
              <strong>${t.traceId}</strong> · Model: <code>${escapeHtml(t.modelId)}</code> · Source: <strong>${
            t.source
          }</strong> (${t.latencyMs}ms)
            </div>
            <div>
              Schema Valid: <strong>${t.schemaValid ? 'YES ✓' : 'NO ✗'}</strong> · Rules Gate: <strong>${
            t.rulesGateValid ? 'PASSED ✓' : 'REJECTED ✗'
          }</strong> · Route Changed: <strong>${t.routeChanged ? 'YES ✓' : 'NO'}</strong>
            </div>
            <div>
              Goal: <code>${t.previousPartyGoal}</code> → <code>${t.newPartyGoal}</code> · Intent: <code>${
            t.executedIntent.type
          }</code>
            </div>
          </div>
        `
        )
        .join('');
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initUiControls(): void {
  const chatForm = document.getElementById('chat-form') as HTMLFormElement | null;
  const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
  const targetSelect = document.getElementById('target-agent-select') as HTMLSelectElement | null;
  const playerNameInput = document.getElementById('player-name-input') as HTMLInputElement | null;

  playerNameInput?.addEventListener('change', () => {
    sendWsMessage({
      version: '1.0',
      requestId: `rename-${Date.now()}`,
      roomId: 'main-room',
      type: 'join_room',
      playerId: myPlayerId!,
      playerName: playerNameInput.value.trim() || 'Mira the Herbalist',
    });
  });

  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!chatInput || !chatInput.value.trim()) return;
    const text = chatInput.value.trim();
    const targetAgentId = (targetSelect?.value as ClassId) || 'mage';

    sendWsMessage({
      version: '1.0',
      requestId: `chat-${Date.now()}`,
      roomId: 'main-room',
      type: 'chat_message',
      targetAgentId,
      text,
    });
    chatInput.value = '';
  });

  // Guided demo preset chips
  document.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target') as ClassId | null;
      const text = btn.getAttribute('data-text');
      if (target && targetSelect) {
        targetSelect.value = target;
      }
      if (text) {
        if (chatInput) chatInput.value = text;
        sendWsMessage({
          version: '1.0',
          requestId: `preset-${Date.now()}`,
          roomId: 'main-room',
          type: 'chat_message',
          targetAgentId: target || 'mage',
          text,
        });
      }
    });
  });

  document.getElementById('btn-interact')?.addEventListener('click', () => {
    const target = (targetSelect?.value as ClassId) || undefined;
    sendWsMessage({
      version: '1.0',
      requestId: `interact-${Date.now()}`,
      roomId: 'main-room',
      type: 'interact',
      targetId: target,
    });
  });

  document.getElementById('btn-teleport')?.addEventListener('click', () => {
    sendWsMessage({
      version: '1.0',
      requestId: `tp-${Date.now()}`,
      roomId: 'main-room',
      type: 'control_room',
      action: 'teleport_near_party',
    });
  });

  document.getElementById('btn-pause')?.addEventListener('click', () => {
    sendWsMessage({
      version: '1.0',
      requestId: `pause-${Date.now()}`,
      roomId: 'main-room',
      type: 'control_room',
      action: 'toggle_pause',
    });
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    sendWsMessage({
      version: '1.0',
      requestId: `reset-${Date.now()}`,
      roomId: 'main-room',
      type: 'control_room',
      action: 'reset',
    });
  });

  document.getElementById('btn-step')?.addEventListener('click', () => {
    fetch('/api/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'main-room', steps: 5 }),
    }).catch((err) => console.error('Step error:', err));
  });

  // Tabs
  const tabBtnEvents = document.getElementById('tab-btn-events');
  const tabBtnTraces = document.getElementById('tab-btn-traces');
  const tabEvents = document.getElementById('tab-events');
  const tabTraces = document.getElementById('tab-traces');

  tabBtnEvents?.addEventListener('click', () => {
    tabBtnEvents.classList.add('active');
    tabBtnTraces?.classList.remove('active');
    tabEvents?.classList.remove('hidden');
    tabTraces?.classList.add('hidden');
  });

  tabBtnTraces?.addEventListener('click', () => {
    tabBtnTraces.classList.add('active');
    tabBtnEvents?.classList.remove('active');
    tabTraces?.classList.remove('hidden');
    tabEvents?.classList.add('hidden');
  });
}

function bootGame(): void {
  initUiControls();

  worldScene = new RpgWorldScene({
    onMoveDirection: (dir) => {
      sound.playStep();
      sendWsMessage({
        version: '1.0',
        requestId: `move-${Date.now()}`,
        roomId: 'main-room',
        type: 'move_input',
        direction: dir,
      });
    },
    onMoveToTile: (tile: Tile) => {
      sound.playStep();
      sendWsMessage({
        version: '1.0',
        requestId: `movetile-${Date.now()}`,
        roomId: 'main-room',
        type: 'move_input',
        targetTile: tile,
      });
    },
    onInteract: (targetId) => {
      sendWsMessage({
        version: '1.0',
        requestId: `interact-${Date.now()}`,
        roomId: 'main-room',
        type: 'interact',
        targetId,
      });
    },
    onSelectAgent: (agentId: ClassId) => {
      const targetSelect = document.getElementById('target-agent-select') as HTMLSelectElement | null;
      if (targetSelect) {
        targetSelect.value = agentId;
      }
    },
  });

  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'phaser-container',
    width: MAP_WIDTH * TILE_SIZE,
    height: MAP_HEIGHT * TILE_SIZE,
    backgroundColor: '#0c101a',
    pixelArt: true,
    scene: [worldScene],
  });

  connectWebSocket();
}

bootGame();
