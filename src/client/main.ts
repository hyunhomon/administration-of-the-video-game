import Phaser from 'phaser';
import {
  ClassId,
  ClientMessage,
  PartyGoalId,
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
let selectedHeroId: ClassId = 'mage';

const HERO_PORTRAIT_SVGS: Record<ClassId, string> = {
  warrior: `<svg viewBox="0 0 32 32" width="34" height="34" style="image-rendering:pixelated">
    <rect x="6" y="4" width="20" height="6" fill="#60a5fa"/>
    <rect x="14" y="2" width="4" height="5" fill="#ef4444"/>
    <rect x="8" y="10" width="16" height="10" fill="#fde68a"/>
    <rect x="10" y="13" width="3" height="3" fill="#0f172a"/>
    <rect x="19" y="13" width="3" height="3" fill="#0f172a"/>
    <rect x="6" y="20" width="20" height="10" fill="#2563eb"/>
    <rect x="12" y="22" width="8" height="6" fill="#f59e0b"/>
  </svg>`,
  mage: `<svg viewBox="0 0 32 32" width="34" height="34" style="image-rendering:pixelated">
    <polygon points="16,2 4,12 28,12" fill="#9333ea"/>
    <rect x="6" y="10" width="20" height="3" fill="#facc15"/>
    <rect x="9" y="13" width="14" height="9" fill="#fde68a"/>
    <rect x="11" y="15" width="3" height="3" fill="#3b0764"/>
    <rect x="18" y="15" width="3" height="3" fill="#3b0764"/>
    <rect x="7" y="22" width="18" height="8" fill="#6b21a8"/>
    <rect x="14" y="23" width="4" height="6" fill="#fde047"/>
  </svg>`,
  thief: `<svg viewBox="0 0 32 32" width="34" height="34" style="image-rendering:pixelated">
    <rect x="7" y="4" width="18" height="8" fill="#047857"/>
    <rect x="9" y="11" width="14" height="9" fill="#fde68a"/>
    <rect x="9" y="15" width="14" height="5" fill="#064e3b"/>
    <rect x="11" y="12" width="3" height="2" fill="#ecfdf5"/>
    <rect x="18" y="12" width="3" height="2" fill="#ecfdf5"/>
    <rect x="7" y="20" width="18" height="10" fill="#059669"/>
    <rect x="13" y="22" width="6" height="4" fill="#a7f3d0"/>
  </svg>`,
  priest: `<svg viewBox="0 0 32 32" width="34" height="34" style="image-rendering:pixelated">
    <rect x="10" y="2" width="12" height="2" fill="#fef08a"/>
    <rect x="7" y="5" width="18" height="7" fill="#f8fafc"/>
    <rect x="14" y="6" width="4" height="5" fill="#f59e0b"/>
    <rect x="9" y="12" width="14" height="8" fill="#fde68a"/>
    <rect x="11" y="14" width="3" height="3" fill="#1e293b"/>
    <rect x="18" y="14" width="3" height="3" fill="#1e293b"/>
    <rect x="7" y="20" width="18" height="10" fill="#f1f5f9"/>
    <rect x="13" y="21" width="6" height="8" fill="#f59e0b"/>
  </svg>`,
};

const GOAL_SHORT_NAMES: Record<PartyGoalId, string> = {
  march_to_cave: '🌋 March to Cave (26,9)',
  investigate_storehouse: '🏛️ Inspect Storehouse (5,4)',
  investigate_marsh: '🌿 Check Marsh (16,4)',
  defeat_guardian: '⚔️ Defeat Guardian (26,9)',
  recover_seal: '✨ Recover Ancient Seal (26,12)',
  celebrate_victory: '🏆 Seal Recovered!',
};

function getTrustAttitude(trust: number): { label: string; color: string } {
  if (trust >= 25) return { label: '★ Trusted Ally', color: '#34d399' };
  if (trust >= 8) return { label: '😊 Receptive', color: '#6ee7b7' };
  if (trust <= -20) return { label: '⚠️ Distrusted', color: '#f87171' };
  if (trust < 0) return { label: '🤨 Skeptical', color: '#fca5a5' };
  return { label: '😐 Neutral', color: '#cbd5e1' };
}

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
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role') || 'Village Herbalist';
    sendWsMessage({
      version: '1.0',
      requestId: `join-${Date.now()}`,
      roomId: 'main-room',
      type: 'join_room',
      playerId: myPlayerId!,
      playerName: nameInput?.value || 'Mira the Herbalist',
      roleTitle: roleParam.replace(/_/g, ' '),
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
    if (msg.speakerKind === 'agent') {
      updateDialogueFeedbackBanner(
        msg.speakerId as ClassId,
        msg.speakerName,
        'In-World Hero Response',
        msg.text
      );
    }
  } else if (msg.type === 'agent_decision_summary') {
    renderLatestTraceCausalChain(msg.trace);
    if (msg.trace.routeChanged) {
      sound.playRouteChange();
    } else if (msg.trace.promptInjectionBlocked) {
      sound.playAlert();
    }
  }
}

function updateDialogueFeedbackBanner(
  heroId: ClassId,
  speakerName: string,
  tagText: string,
  speechText: string
): void {
  const portraitEl = document.getElementById('feedback-portrait');
  const nameEl = document.getElementById('feedback-speaker-name');
  const tagEl = document.getElementById('feedback-speaker-tag');
  const speechEl = document.getElementById('feedback-speech-text');

  if (portraitEl && HERO_PORTRAIT_SVGS[heroId]) {
    portraitEl.innerHTML = HERO_PORTRAIT_SVGS[heroId];
  }
  if (nameEl) nameEl.textContent = speakerName;
  if (tagEl) tagEl.textContent = tagText;
  if (speechEl) speechEl.textContent = `“${speechText}”`;
}

function applySnapshot(snapshot: WorldSnapshot): void {
  latestSnapshot = snapshot;

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
  const hudAiBadge = document.getElementById('hud-ai-badge');
  const hudTraceCount = document.getElementById('hud-trace-count');
  const diagModelInfo = document.getElementById('diag-model-info');
  const diagRoomInfo = document.getElementById('diag-room-info');

  const srcTag =
    snapshot.aiStats.lastSource === 'gemini-4-argon'
      ? 'LIVE API'
      : snapshot.aiStats.lastSource === 'offline_fallback'
      ? 'FALLBACK'
      : snapshot.aiStats.lastSource === 'security_gate'
      ? 'SECURITY GATE'
      : 'READY';

  if (modelLabel) {
    modelLabel.textContent = `Model: ${snapshot.aiStats.configuredModel} (${srcTag})`;
  }
  if (hudAiBadge) {
    hudAiBadge.textContent = `✨ ${snapshot.aiStats.configuredModel} · ${srcTag}`;
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
  if (hudTraceCount) {
    hudTraceCount.textContent = String(snapshot.traces.length);
  }
  if (routeIndicator) {
    routeIndicator.textContent = `Active Route: ${GOAL_LABELS[snapshot.partyGoal]} → (${snapshot.partyDestination.x}, ${snapshot.partyDestination.y})`;
  }
  if (pauseBtn) {
    pauseBtn.textContent = snapshot.paused ? '▶️ Resume Walk' : '⏸️ Pause Walk';
  }
  if (diagModelInfo) {
    diagModelInfo.textContent = `Model: ${snapshot.aiStats.configuredModel} (${srcTag}) · Calls Used: ${snapshot.aiStats.callsUsed}/${snapshot.aiStats.maxCallsPerRoom}`;
  }
  if (diagRoomInfo) {
    const activeHumans = snapshot.humans.filter((h) => h.connected).length;
    diagRoomInfo.textContent = `Room: ${snapshot.roomId} · Rev #${snapshot.revision} · Connected Villagers: ${activeHumans}`;
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

  document.querySelectorAll('.causal-node').forEach((node) => {
    node.classList.add('node-active');
  });
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
      {
        key: 'storehouseInvestigated',
        label: 'Storehouse Verified ✓',
        on: snapshot.quests.storehouseInvestigated,
      },
      {
        key: 'wardBlessingActive',
        label: 'Sacred Ward 🛡️',
        on: snapshot.quests.wardBlessingActive,
      },
      {
        key: 'rumorSuspected',
        label: 'Marsh Lie Disproven ✗',
        on: snapshot.quests.rumorSuspected,
        warn: true,
      },
      { key: 'caveVisited', label: 'Cave Entered', on: snapshot.quests.caveVisited },
      { key: 'sealRecovered', label: 'Ancient Seal 🏆', on: snapshot.quests.sealRecovered },
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
      invRow.innerHTML = `<span class="flag-pill">🎒 Party Bag: Empty (Inspect Storehouse for Relics)</span>`;
    } else {
      invRow.innerHTML = snapshot.inventory
        .map(
          (item) =>
            `<span class="inv-item" title="${escapeHtml(item.description)}">🎒 ${escapeHtml(item.name)}${
              item.equippedBy ? ` · ${item.equippedBy.toUpperCase()}` : ''
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
      const attitude = getTrustAttitude(myTrust);
      const hpPct = Math.max(0, Math.min(100, Math.round((agent.stats.hp / agent.stats.maxHp) * 100)));
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

      const isSelected = agent.id === selectedHeroId;

      return `
        <div class="agent-card ${isSelected ? 'selected-hero' : ''}" data-agent-card="${agent.id}" data-agent-id="${agent.id}">
          <div class="agent-card-header">
            <div class="hero-portrait-box hero-portrait-${agent.role}">
              ${HERO_PORTRAIT_SVGS[agent.id] || ''}
              <span class="hero-lv-pill">Lv.${agent.stats.level}</span>
            </div>
            <div class="hero-identity">
              <div class="agent-card-top">
                <span class="agent-name">${escapeHtml(agent.name)} ${agent.thinking ? '💭' : ''}</span>
                <span class="agent-role-tag">${agent.role} · ${agent.stats.exp} XP</span>
              </div>
              <div class="hero-bars-row">
                <div class="hp-bar-wrap" title="Health Points">
                  <div class="hp-bar-fill" style="width:${hpPct}%"></div>
                  <div class="hp-bar-text">❤️ ${agent.stats.hp}/${agent.stats.maxHp}</div>
                </div>
                <span class="hero-stats-mini">⚔️${agent.stats.atk} 🛡️${agent.stats.def} 🔮${agent.stats.int}</span>
              </div>
            </div>
          </div>

          <div class="hero-intent-trust-row">
            <span class="intent-pill" title="Hero's current vote for party destination">
              Vote: ${GOAL_SHORT_NAMES[agent.goalPreference] || agent.goalPreference}
            </span>
            <span class="trust-pill" style="color:${attitude.color}" title="Attitude & Trust score toward your villager NPC">
              ${attitude.label} (${myTrust >= 0 ? '+' : ''}${myTrust})
            </span>
          </div>

          ${
            agent.equippedItem
              ? `<div class="hero-intent-trust-row" style="border-color:#f59e0b; background:rgba(245,158,11,0.12)">
                  <span style="color:#fde68a; font-weight:800">🗡️ Equipped Gear: ${escapeHtml(
                    agent.equippedItem
                  )}</span>
                </div>`
              : ''
          }

          <div class="agent-speech-box">
            “${escapeHtml(agent.lastSpeech || 'Ready to march.')}”
          </div>

          ${
            latestMem
              ? `<div class="memory-item ${memStatusClass}">
                  <strong>${memBadge}:</strong> ${escapeHtml(latestMem.claim)}
                </div>`
              : `<div class="memory-item">
                  <strong>Goal:</strong> ${escapeHtml(agent.personalGoal)}
                </div>`
          }
        </div>
      `;
    })
    .join('');

  // Allow clicking any hero card to target that hero for dialogue
  grid.querySelectorAll('.agent-card').forEach((card) => {
    card.addEventListener('click', () => {
      const agentId = card.getAttribute('data-agent-card') as ClassId | null;
      if (!agentId) return;
      selectHeroTarget(agentId, true);
    });
  });
}

function selectHeroTarget(agentId: ClassId, focusInput = false): void {
  selectedHeroId = agentId;
  const targetSelect = document.getElementById('target-agent-select') as HTMLSelectElement | null;
  if (targetSelect) {
    targetSelect.value = agentId;
  }
  if (latestSnapshot) {
    const hero = latestSnapshot.actors.find((a) => a.id === agentId);
    if (hero) {
      updateDialogueFeedbackBanner(
        hero.id,
        `${hero.name} (${hero.role.toUpperCase()})`,
        hero.personalGoal,
        hero.lastSpeech || 'Speak, villager. What news do you bring?'
      );
    }
    updateAgentsGrid(latestSnapshot);
  }
  if (focusInput) {
    const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
    chatInput?.focus();
  }
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

function activateDrawerTab(tabName: 'traces' | 'events' | 'diag' | 'dev'): void {
  const tabs: Array<'traces' | 'events' | 'diag' | 'dev'> = ['traces', 'events', 'diag', 'dev'];
  for (const name of tabs) {
    const btn = document.getElementById(`tab-btn-${name}`);
    const panel = document.getElementById(`tab-${name}`);
    if (name === tabName) {
      btn?.classList.add('active');
      panel?.classList.remove('hidden');
    } else {
      btn?.classList.remove('active');
      panel?.classList.add('hidden');
    }
  }
}

function initUiControls(): void {
  const chatForm = document.getElementById('chat-form') as HTMLFormElement | null;
  const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
  const targetSelect = document.getElementById('target-agent-select') as HTMLSelectElement | null;
  const playerNameInput = document.getElementById('player-name-input') as HTMLInputElement | null;

  // Support URL query parameter ?name=... for multi-tab demos
  const params = new URLSearchParams(window.location.search);
  const nameFromUrl = params.get('name');
  if (nameFromUrl && playerNameInput) {
    playerNameInput.value = nameFromUrl.replace(/_/g, ' ');
  }

  // Initialize feedback portrait
  const portraitEl = document.getElementById('feedback-portrait');
  if (portraitEl) {
    portraitEl.innerHTML = HERO_PORTRAIT_SVGS.mage;
  }

  // Onboarding guide controls
  const onboardingBanner = document.getElementById('onboarding-banner');
  document.getElementById('btn-dismiss-onboarding')?.addEventListener('click', () => {
    onboardingBanner?.classList.add('hidden');
  });
  document.getElementById('btn-toggle-guide')?.addEventListener('click', () => {
    onboardingBanner?.classList.toggle('hidden');
  });

  targetSelect?.addEventListener('change', () => {
    selectHeroTarget((targetSelect.value as ClassId) || 'mage', false);
  });

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
      if (target) {
        selectHeroTarget(target, false);
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

  // Secondary Drawer Tabs & Collapse Toggle
  document.getElementById('tab-btn-traces')?.addEventListener('click', () => activateDrawerTab('traces'));
  document.getElementById('tab-btn-events')?.addEventListener('click', () => activateDrawerTab('events'));
  document.getElementById('tab-btn-diag')?.addEventListener('click', () => activateDrawerTab('diag'));
  document.getElementById('tab-btn-dev')?.addEventListener('click', () => activateDrawerTab('dev'));

  const drawerBody = document.getElementById('drawer-body');
  document.getElementById('btn-toggle-drawer')?.addEventListener('click', () => {
    drawerBody?.classList.toggle('collapsed');
  });

  document.getElementById('btn-open-inspector')?.addEventListener('click', () => {
    drawerBody?.classList.remove('collapsed');
    activateDrawerTab('traces');
    document.getElementById('secondary-drawer')?.scrollIntoView({ behavior: 'smooth' });
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
      selectHeroTarget(agentId, true);
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
