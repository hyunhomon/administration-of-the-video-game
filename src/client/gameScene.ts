import Phaser from 'phaser';
import {
  AgentState,
  ClassId,
  EnemyState,
  HumanPlayerState,
  Tile,
  WorldItemState,
  WorldSnapshot,
} from '../shared/contracts.js';
import {
  BASE_GRID,
  findPath,
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE_SIZE,
  TileKind,
} from '../shared/worldMap.js';

export interface SceneCallbacks {
  onMoveDirection: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onMoveToTile: (tile: Tile) => void;
  onInteract: (targetId?: string) => void;
  onSelectAgent: (agentId: ClassId) => void;
}

interface EntityVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  hpBar?: Phaser.GameObjects.Graphics;
  bubbleText?: Phaser.GameObjects.Text;
  bubbleBg?: Phaser.GameObjects.Graphics;
  ring?: Phaser.GameObjects.Graphics;
}

export class RpgWorldScene extends Phaser.Scene {
  private callbacks: SceneCallbacks;
  private snapshot: WorldSnapshot | null = null;
  private myPlayerId: string | null = null;

  private routeGraphics!: Phaser.GameObjects.Graphics;
  private agentVisuals: Map<string, EntityVisual> = new Map();
  private humanVisuals: Map<string, EntityVisual> = new Map();
  private itemVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
  private enemyVisuals: Map<string, EntityVisual> = new Map();

  private lastMoveInputAt = 0;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    UP: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
  };

  constructor(callbacks: SceneCallbacks) {
    super({ key: 'RpgWorldScene' });
    this.callbacks = callbacks;
  }

  public preload(): void {
    this.generatePixelTextures();
  }

  public create(): void {
    this.renderTilemap();
    this.renderLandmarks();

    this.routeGraphics = this.add.graphics();
    this.routeGraphics.setDepth(5);

    if (this.input.keyboard) {
      this.keys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
        E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, false),
        UP: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP, false),
        DOWN: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false),
        LEFT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
        RIGHT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
      };

      this.keys.E.on('down', () => {
        if (this.isTypingInInput()) return;
        this.callbacks.onInteract();
      });
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const gx = Math.floor(pointer.worldX / TILE_SIZE);
      const gy = Math.floor(pointer.worldY / TILE_SIZE);
      if (gx >= 0 && gx < MAP_WIDTH && gy >= 0 && gy < MAP_HEIGHT) {
        // Check if clicked on an agent
        if (this.snapshot) {
          const clickedAgent = this.snapshot.actors.find(
            (a) => Math.abs(a.tile.x - gx) <= 1 && Math.abs(a.tile.y - gy) <= 1
          );
          if (clickedAgent) {
            this.callbacks.onSelectAgent(clickedAgent.id);
          }
        }
        const zone = gx <= 11 ? 'village' : gx <= 20 ? 'crossroads' : 'cave';
        this.callbacks.onMoveToTile({ x: gx, y: gy, zone });
      }
    });

    if (this.snapshot) {
      this.syncSnapshot(this.snapshot, this.myPlayerId);
    }
  }

  public update(time: number): void {
    if (!this.keys || this.isTypingInInput()) return;
    if (time - this.lastMoveInputAt < 150) return;

    if (this.keys.W.isDown || this.keys.UP.isDown) {
      this.lastMoveInputAt = time;
      this.callbacks.onMoveDirection('up');
    } else if (this.keys.S.isDown || this.keys.DOWN.isDown) {
      this.lastMoveInputAt = time;
      this.callbacks.onMoveDirection('down');
    } else if (this.keys.A.isDown || this.keys.LEFT.isDown) {
      this.lastMoveInputAt = time;
      this.callbacks.onMoveDirection('left');
    } else if (this.keys.D.isDown || this.keys.RIGHT.isDown) {
      this.lastMoveInputAt = time;
      this.callbacks.onMoveDirection('right');
    }
  }

  private isTypingInInput(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  public syncSnapshot(snapshot: WorldSnapshot, myPlayerId: string | null): void {
    this.snapshot = snapshot;
    if (myPlayerId) this.myPlayerId = myPlayerId;
    if (!this.scene.isActive()) return;

    this.drawPartyRoute(snapshot);
    this.syncItems(snapshot.items);
    this.syncEnemies(snapshot.enemies);
    this.syncAgents(snapshot.actors);
    this.syncHumans(snapshot.humans);
  }

  private drawPartyRoute(snapshot: WorldSnapshot): void {
    this.routeGraphics.clear();
    const leader = snapshot.actors[0];
    if (!leader) return;

    const path = findPath(leader.tile, snapshot.partyDestination, BASE_GRID);
    if (path.length === 0) return;

    const routeColor =
      snapshot.partyGoal === 'investigate_storehouse'
        ? 0x34d399
        : snapshot.partyGoal === 'investigate_marsh'
        ? 0xf5c451
        : 0x38bdf8;

    this.routeGraphics.lineStyle(3, routeColor, 0.8);
    this.routeGraphics.beginPath();
    this.routeGraphics.moveTo(
      leader.tile.x * TILE_SIZE + TILE_SIZE / 2,
      leader.tile.y * TILE_SIZE + TILE_SIZE / 2
    );

    for (const step of path) {
      const cx = step.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = step.y * TILE_SIZE + TILE_SIZE / 2;
      this.routeGraphics.lineTo(cx, cy);
    }
    this.routeGraphics.strokePath();

    // Target beacon circle
    const destX = snapshot.partyDestination.x * TILE_SIZE + TILE_SIZE / 2;
    const destY = snapshot.partyDestination.y * TILE_SIZE + TILE_SIZE / 2;
    this.routeGraphics.fillStyle(routeColor, 0.35);
    this.routeGraphics.fillCircle(destX, destY, 13);
    this.routeGraphics.lineStyle(2, 0xffffff, 0.9);
    this.routeGraphics.strokeCircle(destX, destY, 13);
  }

  private syncItems(items: WorldItemState[]): void {
    for (const item of items) {
      let container = this.itemVisuals.get(item.id);
      if (item.pickedUp) {
        if (container) container.setVisible(false);
        continue;
      }

      if (!container) {
        const x = item.tile.x * TILE_SIZE + TILE_SIZE / 2;
        const y = item.tile.y * TILE_SIZE + TILE_SIZE / 2;
        const texKey =
          item.kind === 'weapon'
            ? 'tex_item_weapon'
            : item.kind === 'clue'
            ? 'tex_item_clue'
            : item.kind === 'relic'
            ? 'tex_item_relic'
            : item.kind === 'healing'
            ? 'tex_item_herb'
            : 'tex_item_coin';
        const img = this.add.image(0, 0, texKey);
        const label = this.add
          .text(0, 12, item.name, {
            fontSize: '9px',
            color: '#fde68a',
            backgroundColor: '#000000aa',
            padding: { x: 2, y: 1 },
          })
          .setOrigin(0.5, 0);
        container = this.add.container(x, y, [img, label]);
        container.setDepth(6);
        this.itemVisuals.set(item.id, container);
      } else {
        container.setVisible(true);
      }
    }
  }

  private syncEnemies(enemies: EnemyState[]): void {
    for (const enemy of enemies) {
      let vis = this.enemyVisuals.get(enemy.id);
      const targetX = enemy.tile.x * TILE_SIZE + TILE_SIZE / 2;
      const targetY = enemy.tile.y * TILE_SIZE + TILE_SIZE / 2;

      if (!vis) {
        const texKey = enemy.isBoss ? 'tex_enemy_boss' : 'tex_enemy_slime';
        const sprite = this.add.image(0, 0, texKey);
        const hpBar = this.add.graphics();
        const nameText = this.add
          .text(0, 14, enemy.name, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#fca5a5',
            backgroundColor: '#1f090daa',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 0);

        const container = this.add.container(targetX, targetY, [sprite, hpBar, nameText]);
        container.setDepth(8);
        vis = { container, sprite, nameText, hpBar };
        this.enemyVisuals.set(enemy.id, vis);
      }

      if (enemy.defeated) {
        vis.sprite.setAlpha(0.35);
        vis.nameText.setText(`${enemy.name} (Defeated)`);
        vis.hpBar?.clear();
      } else {
        vis.sprite.setAlpha(1);
        vis.nameText.setText(`${enemy.name} Lv.${enemy.stats.level}`);
        vis.hpBar?.clear();
        vis.hpBar?.fillStyle(0x000000, 0.8);
        vis.hpBar?.fillRect(-14, -20, 28, 4);
        const ratio = Math.max(0, enemy.stats.hp / enemy.stats.maxHp);
        vis.hpBar?.fillStyle(0xef4444, 1);
        vis.hpBar?.fillRect(-14, -20, Math.round(28 * ratio), 4);
      }
    }
  }

  private syncAgents(actors: AgentState[]): void {
    for (const agent of actors) {
      let vis = this.agentVisuals.get(agent.id);
      const targetX = agent.tile.x * TILE_SIZE + TILE_SIZE / 2;
      const targetY = agent.tile.y * TILE_SIZE + TILE_SIZE / 2;

      if (!vis) {
        const sprite = this.add.image(0, 0, `tex_agent_${agent.role}`);
        const hpBar = this.add.graphics();
        const nameText = this.add
          .text(0, 13, `${agent.name} Lv.${agent.stats.level}`, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#fef08a',
            backgroundColor: '#0c101acc',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 0);

        const bubbleBg = this.add.graphics();
        const bubbleText = this.add
          .text(0, -28, '', {
            fontSize: '10px',
            color: '#0f172a',
            wordWrap: { width: 170 },
            align: 'center',
          })
          .setOrigin(0.5, 1);

        const container = this.add.container(targetX, targetY, [
          sprite,
          hpBar,
          nameText,
          bubbleBg,
          bubbleText,
        ]);
        container.setDepth(12);
        vis = { container, sprite, nameText, hpBar, bubbleBg, bubbleText };
        this.agentVisuals.set(agent.id, vis);
      } else {
        this.tweens.add({
          targets: vis.container,
          x: targetX,
          y: targetY,
          duration: 240,
          ease: 'Linear',
        });
      }

      vis.nameText.setText(
        `${agent.thinking ? '💭 ' : ''}${agent.name} Lv.${agent.stats.level}`
      );

      // HP bar
      vis.hpBar?.clear();
      vis.hpBar?.fillStyle(0x000000, 0.75);
      vis.hpBar?.fillRect(-13, -18, 26, 4);
      const hpRatio = Math.max(0, Math.min(1, agent.stats.hp / agent.stats.maxHp));
      vis.hpBar?.fillStyle(0x22c55e, 1);
      vis.hpBar?.fillRect(-13, -18, Math.round(26 * hpRatio), 4);

      // Speech bubble for primary leader or recently spoken hero
      const isRecentSpeech =
        agent.lastSpeech &&
        agent.lastSpeechAt &&
        Date.now() - agent.lastSpeechAt < 14000;

      if (isRecentSpeech && vis.bubbleText && vis.bubbleBg) {
        const shortText =
          agent.lastSpeech!.length > 85
            ? agent.lastSpeech!.slice(0, 82) + '...'
            : agent.lastSpeech!;
        vis.bubbleText.setText(shortText);
        vis.bubbleText.setVisible(true);
        const bounds = vis.bubbleText.getBounds();
        const w = Math.max(60, bounds.width + 10);
        const h = bounds.height + 6;
        vis.bubbleBg.clear();
        vis.bubbleBg.fillStyle(0xffffff, 0.94);
        vis.bubbleBg.lineStyle(1.5, 0x0284c7, 1);
        vis.bubbleBg.fillRoundedRect(-w / 2, -26 - h, w, h, 5);
        vis.bubbleBg.strokeRoundedRect(-w / 2, -26 - h, w, h, 5);
        vis.bubbleBg.setVisible(true);
      } else {
        vis.bubbleText?.setVisible(false);
        vis.bubbleBg?.setVisible(false);
      }
    }
  }

  private syncHumans(humans: HumanPlayerState[]): void {
    const activeIds = new Set(humans.filter((h) => h.connected).map((h) => h.id));

    for (const [id, vis] of this.humanVisuals.entries()) {
      if (!activeIds.has(id)) {
        vis.container.destroy();
        this.humanVisuals.delete(id);
      }
    }

    for (const human of humans) {
      if (!human.connected) continue;
      let vis = this.humanVisuals.get(human.id);
      const isMe = human.id === this.myPlayerId;
      const targetX = human.tile.x * TILE_SIZE + TILE_SIZE / 2;
      const targetY = human.tile.y * TILE_SIZE + TILE_SIZE / 2;

      if (!vis) {
        const ring = this.add.graphics();
        const sprite = this.add.image(0, 0, isMe ? 'tex_human_me' : 'tex_human_peer');
        const nameText = this.add
          .text(0, 14, isMe ? `★ ${human.name} (YOU)` : `${human.name} (NPC)`, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: isMe ? '#38bdf8' : '#c084fc',
            backgroundColor: '#090d16dd',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 0);

        const bubbleBg = this.add.graphics();
        const bubbleText = this.add
          .text(0, -24, '', {
            fontSize: '10px',
            color: '#0f172a',
            wordWrap: { width: 160 },
            align: 'center',
          })
          .setOrigin(0.5, 1);

        const container = this.add.container(targetX, targetY, [
          ring,
          sprite,
          nameText,
          bubbleBg,
          bubbleText,
        ]);
        container.setDepth(15);
        vis = { container, sprite, nameText, ring, bubbleBg, bubbleText };
        this.humanVisuals.set(human.id, vis);
      } else {
        this.tweens.add({
          targets: vis.container,
          x: targetX,
          y: targetY,
          duration: 130,
          ease: 'Quad.easeOut',
        });
      }

      vis.nameText.setText(isMe ? `★ ${human.name} (YOU)` : `${human.name} (NPC)`);
      vis.ring?.clear();
      if (isMe) {
        vis.ring?.lineStyle(2, 0x38bdf8, 0.95);
        vis.ring?.strokeCircle(0, 4, 14);
      } else {
        vis.ring?.lineStyle(1.5, 0xc084fc, 0.75);
        vis.ring?.strokeCircle(0, 4, 13);
      }

      const isRecentSpeech =
        human.lastSpeech && human.lastSpeechAt && Date.now() - human.lastSpeechAt < 12000;
      if (isRecentSpeech && vis.bubbleText && vis.bubbleBg) {
        const shortText =
          human.lastSpeech!.length > 75
            ? human.lastSpeech!.slice(0, 72) + '...'
            : human.lastSpeech!;
        vis.bubbleText.setText(shortText);
        vis.bubbleText.setVisible(true);
        const bounds = vis.bubbleText.getBounds();
        const w = Math.max(55, bounds.width + 10);
        const h = bounds.height + 6;
        vis.bubbleBg.clear();
        vis.bubbleBg.fillStyle(0xe0f2fe, 0.95);
        vis.bubbleBg.lineStyle(1.5, 0x0284c7, 1);
        vis.bubbleBg.fillRoundedRect(-w / 2, -22 - h, w, h, 5);
        vis.bubbleBg.strokeRoundedRect(-w / 2, -22 - h, w, h, 5);
        vis.bubbleBg.setVisible(true);
      } else {
        vis.bubbleText?.setVisible(false);
        vis.bubbleBg?.setVisible(false);
      }
    }
  }

  private renderTilemap(): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const kind = BASE_GRID[y][x];
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;

        let tex = 'tile_grass';
        if (kind === TileKind.Road) tex = 'tile_road';
        else if (kind === TileKind.StoneFloor) tex = 'tile_stone';
        else if (kind === TileKind.Water) tex = 'tile_water';
        else if (kind === TileKind.Tree) tex = 'tile_tree';
        else if (kind === TileKind.BuildingWall) tex = 'tile_wall';
        else if (kind === TileKind.CaveWall) tex = 'tile_cave_wall';
        else if (kind === TileKind.MarshGrass) tex = 'tile_marsh';
        else if (kind === TileKind.Bridge) tex = 'tile_bridge';
        else if (kind === TileKind.Altar) tex = 'tile_altar';

        this.add.image(cx, cy, tex).setDepth(1);
      }
    }
  }

  private renderLandmarks(): void {
    const labels = [
      {
        x: 5.5,
        y: 1.5,
        text: '🏛️ OLD STOREHOUSE (Seal Ledger & Sunsteel Vault)',
        color: '#a7f3d0',
      },
      { x: 6.5, y: 11.3, text: '🏘️ OAKHAVEN VILLAGE SQUARE', color: '#fde68a' },
      { x: 3.0, y: 14.5, text: '⛩️ DAWN SHRINE', color: '#e2e8f0' },
      {
        x: 16.0,
        y: 1.5,
        text: '🌿 WHISPERING MARSH (Rumored Chest)',
        color: '#fde047',
      },
      { x: 15.5, y: 11.3, text: '🪧 CROSSROADS', color: '#cbd5e1' },
      {
        x: 26.0,
        y: 2.0,
        text: '🌋 CAVERN OF THE ANCIENT SEAL',
        color: '#fca5a5',
      },
    ];

    for (const l of labels) {
      this.add
        .text(l.x * TILE_SIZE, l.y * TILE_SIZE, l.text, {
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: l.color,
          backgroundColor: '#090d16cc',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0.5)
        .setDepth(4);
    }
  }

  /**
   * Generates crisp 16-bit style 32x32 tile and character sprite textures programmatically
   * (100% original CC0 pixel art, zero external asset load failures).
   */
  private generatePixelTextures(): void {
    // 1. Grass tile
    this.makeTex('tile_grass', (g) => {
      g.fillStyle(0x2d5a27);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x36692f);
      g.fillRect(4, 6, 4, 4);
      g.fillRect(20, 18, 4, 4);
      g.fillStyle(0x417a39);
      g.fillRect(12, 24, 3, 3);
    });

    // 2. Road tile
    this.makeTex('tile_road', (g) => {
      g.fillStyle(0x8c6d46);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x9e7e56);
      g.fillRect(2, 4, 10, 8);
      g.fillRect(16, 16, 12, 10);
      g.fillStyle(0x735736);
      g.fillRect(18, 4, 8, 8);
      g.fillRect(4, 18, 9, 8);
    });

    // 3. Stone floor
    this.makeTex('tile_stone', (g) => {
      g.fillStyle(0x3b4252);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(1, 0x2e3440);
      g.strokeRect(1, 1, 14, 14);
      g.strokeRect(16, 1, 15, 14);
      g.strokeRect(1, 16, 14, 15);
      g.strokeRect(16, 16, 15, 15);
    });

    // 4. Water tile
    this.makeTex('tile_water', (g) => {
      g.fillStyle(0x1d4ed8);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x3b82f6);
      g.fillRect(4, 8, 10, 3);
      g.fillRect(16, 22, 10, 3);
    });

    // 5. Tree tile
    this.makeTex('tile_tree', (g) => {
      g.fillStyle(0x1e3f1b);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x5c4033);
      g.fillRect(12, 22, 8, 8);
      g.fillStyle(0x15803d);
      g.fillCircle(16, 15, 11);
      g.fillStyle(0x22c55e);
      g.fillCircle(14, 12, 6);
    });

    // 6. Building wall
    this.makeTex('tile_wall', (g) => {
      g.fillStyle(0x7c2d12);
      g.fillRect(0, 0, 32, 14);
      g.fillStyle(0xd6d3d1);
      g.fillRect(2, 14, 28, 18);
      g.fillStyle(0x451a03);
      g.fillRect(12, 18, 8, 8);
    });

    // 7. Cave wall
    this.makeTex('tile_cave_wall', (g) => {
      g.fillStyle(0x1e1b2e);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x312e43);
      g.fillRect(4, 4, 24, 24);
      g.fillStyle(0x110f1a);
      g.fillRect(8, 10, 6, 6);
    });

    // 8. Marsh grass
    this.makeTex('tile_marsh', (g) => {
      g.fillStyle(0x365314);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x4d7c0f);
      g.fillRect(6, 6, 6, 10);
      g.fillRect(20, 14, 6, 10);
    });

    // 9. Bridge
    this.makeTex('tile_bridge', (g) => {
      g.fillStyle(0x1d4ed8);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x92400e);
      g.fillRect(0, 2, 32, 28);
      g.lineStyle(2, 0x451a03);
      g.strokeRect(2, 2, 28, 28);
    });

    // 10. Altar
    this.makeTex('tile_altar', (g) => {
      g.fillStyle(0x4c1d95);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xf59e0b);
      g.fillRect(6, 6, 20, 20);
      g.fillStyle(0xfef08a);
      g.fillRect(10, 10, 12, 12);
    });

    // Character Sprites
    this.makeHeroTex('tex_agent_warrior', 0x2563eb, 0xdc2626, 0xe2e8f0);
    this.makeHeroTex('tex_agent_mage', 0x7c3aed, 0x4c1d95, 0xfef08a);
    this.makeHeroTex('tex_agent_thief', 0x059669, 0x064e3b, 0xa7f3d0);
    this.makeHeroTex('tex_agent_priest', 0xf8fafc, 0xf59e0b, 0xfde047);

    this.makeHeroTex('tex_human_me', 0x0ea5e9, 0x0284c7, 0x38bdf8);
    this.makeHeroTex('tex_human_peer', 0xa855f7, 0x6b21a8, 0xe9d5ff);

    // Enemies
    this.makeTex('tex_enemy_slime', (g) => {
      g.fillStyle(0x10b981);
      g.fillCircle(16, 18, 10);
      g.fillStyle(0xffffff);
      g.fillRect(11, 14, 3, 3);
      g.fillRect(18, 14, 3, 3);
      g.fillStyle(0x000000);
      g.fillRect(12, 15, 2, 2);
      g.fillRect(19, 15, 2, 2);
    });

    this.makeTex('tex_enemy_boss', (g) => {
      g.fillStyle(0x991b1b);
      g.fillRect(4, 4, 24, 24);
      g.fillStyle(0xf59e0b);
      g.fillRect(8, 8, 6, 6);
      g.fillRect(18, 8, 6, 6);
      g.fillStyle(0xfef08a);
      g.fillRect(10, 20, 12, 4);
    });

    // Items
    this.makeTex('tex_item_coin', (g) => {
      g.fillStyle(0xf59e0b);
      g.fillCircle(16, 16, 7);
      g.fillStyle(0xfef08a);
      g.fillCircle(15, 15, 4);
    });

    this.makeTex('tex_item_herb', (g) => {
      g.fillStyle(0x22c55e);
      g.fillCircle(16, 16, 7);
      g.fillStyle(0x86efac);
      g.fillRect(14, 10, 4, 12);
    });

    this.makeTex('tex_item_clue', (g) => {
      g.fillStyle(0x38bdf8);
      g.fillRect(8, 7, 16, 18);
      g.fillStyle(0xfef08a);
      g.fillRect(10, 10, 12, 3);
      g.fillRect(10, 15, 12, 3);
    });

    this.makeTex('tex_item_weapon', (g) => {
      g.fillStyle(0xfacc15);
      g.fillRect(14, 5, 4, 18);
      g.fillStyle(0xd97706);
      g.fillRect(10, 19, 12, 4);
    });

    this.makeTex('tex_item_relic', (g) => {
      g.fillStyle(0xf59e0b);
      g.fillCircle(16, 16, 9);
      g.fillStyle(0x38bdf8);
      g.fillCircle(16, 16, 5);
    });
  }

  private makeHeroTex(key: string, primaryColor: number, trimColor: number, accentColor: number): void {
    this.makeTex(key, (g) => {
      // Shadow
      g.fillStyle(0x000000, 0.45);
      g.fillEllipse(16, 28, 18, 6);
      // Cloak/Body
      g.fillStyle(primaryColor);
      g.fillRect(8, 13, 16, 13);
      // Trim
      g.fillStyle(trimColor);
      g.fillRect(8, 22, 16, 4);
      // Head
      g.fillStyle(0xfde68a);
      g.fillRect(10, 5, 12, 9);
      // Hat/Helm
      g.fillStyle(accentColor);
      g.fillRect(9, 3, 14, 4);
      // Eyes
      g.fillStyle(0x0f172a);
      g.fillRect(12, 8, 2, 2);
      g.fillRect(18, 8, 2, 2);
    });
  }

  private makeTex(key: string, drawFn: (g: Phaser.GameObjects.Graphics) => void): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    drawFn(g);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }
}
