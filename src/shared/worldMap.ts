import { Tile, ZoneId, PartyGoalId } from './contracts.js';

export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 22;
export const TILE_SIZE = 32;

export enum TileKind {
  Grass = 0,
  Road = 1,
  StoneFloor = 2,
  Water = 3,
  Tree = 4,
  BuildingWall = 5,
  CaveWall = 6,
  MarshGrass = 7,
  Bridge = 8,
  Altar = 9,
}

export function getZoneForX(x: number): ZoneId {
  if (x <= 11) return 'village';
  if (x <= 20) return 'crossroads';
  return 'cave';
}

export function makeTile(x: number, y: number): Tile {
  const clampedX = Math.max(0, Math.min(MAP_WIDTH - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.round(y)));
  return { x: clampedX, y: clampedY, zone: getZoneForX(clampedX) };
}

export const GOAL_DESTINATIONS: Record<PartyGoalId, Tile> = {
  march_to_cave: { x: 26, y: 9, zone: 'cave' },
  investigate_storehouse: { x: 5, y: 4, zone: 'village' },
  investigate_marsh: { x: 16, y: 4, zone: 'crossroads' },
  defeat_guardian: { x: 26, y: 9, zone: 'cave' },
  recover_seal: { x: 26, y: 5, zone: 'cave' },
  celebrate_victory: { x: 7, y: 13, zone: 'village' },
};

export const GOAL_LABELS: Record<PartyGoalId, string> = {
  march_to_cave: 'March East to the Cavern of the Ancient Seal',
  investigate_storehouse: 'Detour North to Investigate the Old Storehouse Archives',
  investigate_marsh: 'Detour to Search the Whispering Marsh Rumor Site',
  defeat_guardian: 'Vanquish the Seal Guardian in the Cavern',
  recover_seal: 'Claim the Ancient Seal from the Sanctuary Altar',
  celebrate_victory: 'Return to Oakhaven Square in Triumph',
};

// Build deterministic 32x22 tilemap
export function createBaseGrid(): TileKind[][] {
  const grid: TileKind[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => TileKind.Grass)
  );

  // Outer border trees and cave walls
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (x >= 21) {
        grid[y][x] = TileKind.CaveWall;
      }
      if (y === 0 || y === MAP_HEIGHT - 1 || x === 0 || x === MAP_WIDTH - 1) {
        grid[y][x] = x >= 21 ? TileKind.CaveWall : TileKind.Tree;
      }
    }
  }

  // Cave interior (x: 22..29, y: 3..18)
  for (let y = 3; y <= 17; y++) {
    for (let x = 23; x <= 29; x++) {
      grid[y][x] = TileKind.StoneFloor;
    }
  }
  // Cave entrance corridor (x: 21..23, y: 12..14)
  for (let y = 12; y <= 14; y++) {
    for (let x = 21; x <= 23; x++) {
      grid[y][x] = TileKind.StoneFloor;
    }
  }
  // Cave internal pillars for tactical paths
  grid[7][24] = TileKind.CaveWall;
  grid[7][28] = TileKind.CaveWall;
  grid[11][24] = TileKind.CaveWall;
  grid[11][28] = TileKind.CaveWall;

  // Ancient Seal Altar at (26, 4..5)
  grid[4][26] = TileKind.Altar;
  grid[5][26] = TileKind.Altar;
  grid[5][25] = TileKind.StoneFloor;
  grid[5][27] = TileKind.StoneFloor;

  // River separating Crossroads and Cave (x = 20, y = 1..20)
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    grid[y][20] = TileKind.Water;
  }
  // Bridge across river at y = 12..14
  grid[12][20] = TileKind.Bridge;
  grid[13][20] = TileKind.Bridge;
  grid[14][20] = TileKind.Bridge;

  // Old Storehouse in North Village (x: 3..8, y: 2..6)
  for (let y = 2; y <= 6; y++) {
    for (let x = 3; x <= 8; x++) {
      if (y === 2 || y === 6 || x === 3 || x === 8) {
        grid[y][x] = TileKind.BuildingWall;
      } else {
        grid[y][x] = TileKind.StoneFloor;
      }
    }
  }
  // Storehouse doorway at (5, 6) and (6, 6)
  grid[6][5] = TileKind.StoneFloor;
  grid[6][6] = TileKind.StoneFloor;

  // Village Houses (decorative obstacles)
  for (let y = 8; y <= 10; y++) {
    for (let x = 2; x <= 4; x++) {
      grid[y][x] = TileKind.BuildingWall;
    }
    for (let x = 8; x <= 10; x++) {
      grid[y][x] = TileKind.BuildingWall;
    }
  }

  // Village Shrine (x: 2..4, y: 15..17)
  for (let y = 15; y <= 17; y++) {
    for (let x = 2; x <= 4; x++) {
      grid[y][x] = TileKind.StoneFloor;
    }
  }
  grid[16][3] = TileKind.Altar;

  // Whispering Marsh in North Crossroads (x: 13..19, y: 2..7)
  for (let y = 2; y <= 7; y++) {
    for (let x = 13; x <= 19; x++) {
      grid[y][x] = TileKind.MarshGrass;
    }
  }
  // Marsh water hazards
  grid[3][14] = TileKind.Water;
  grid[4][14] = TileKind.Water;
  grid[3][18] = TileKind.Water;
  grid[5][18] = TileKind.Water;
  grid[4][16] = TileKind.Altar; // Marsh rumor chest spot

  // Forest clusters in Crossroads
  grid[8][12] = TileKind.Tree;
  grid[9][12] = TileKind.Tree;
  grid[16][12] = TileKind.Tree;
  grid[17][12] = TileKind.Tree;
  grid[17][17] = TileKind.Tree;
  grid[18][17] = TileKind.Tree;

  // Main East-West Road (y = 12..14 from x = 4 to x = 26)
  for (let x = 4; x <= 26; x++) {
    if (x === 20) continue; // Keep bridge tiles
    grid[13][x] = x >= 21 ? TileKind.StoneFloor : TileKind.Road;
    if (x >= 5 && x <= 9) {
      // Town square courtyard
      grid[12][x] = TileKind.Road;
      grid[14][x] = TileKind.Road;
    }
  }

  // North-South Road from Village Square (x = 5..6, y = 6..13) to Storehouse
  for (let y = 6; y <= 13; y++) {
    grid[y][5] = TileKind.Road;
    grid[y][6] = TileKind.Road;
  }

  // North-South Trail in Crossroads (x = 15..16, y = 4..13) to Whispering Marsh
  for (let y = 4; y <= 13; y++) {
    grid[y][15] = TileKind.Road;
    grid[y][16] = y <= 6 ? TileKind.MarshGrass : TileKind.Road;
  }

  // Cave path North from (26, 13) to Altar (26, 5)
  for (let y = 5; y <= 13; y++) {
    grid[y][25] = TileKind.StoneFloor;
    grid[y][26] = y <= 5 ? TileKind.Altar : TileKind.StoneFloor;
    grid[y][27] = TileKind.StoneFloor;
  }

  return grid;
}

export const BASE_GRID: TileKind[][] = createBaseGrid();

export function isTileWalkable(x: number, y: number, grid: TileKind[][] = BASE_GRID): boolean {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
  const kind = grid[y][x];
  return (
    kind === TileKind.Grass ||
    kind === TileKind.Road ||
    kind === TileKind.StoneFloor ||
    kind === TileKind.MarshGrass ||
    kind === TileKind.Bridge ||
    kind === TileKind.Altar
  );
}

export function tileDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isAdjacentOrNear(a: { x: number; y: number }, b: { x: number; y: number }, maxDist = 4): boolean {
  return Math.abs(a.x - b.x) <= maxDist && Math.abs(a.y - b.y) <= maxDist;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent?: AStarNode;
}

/**
 * Deterministic 4-directional A* pathfinder on the authoritative grid.
 * Returns array of step tiles excluding start tile, up to destination (or closest reachable tile).
 */
export function findPath(
  start: { x: number; y: number },
  goal: { x: number; y: number },
  grid: TileKind[][] = BASE_GRID
): Tile[] {
  const sx = Math.round(start.x);
  const sy = Math.round(start.y);
  let gx = Math.round(goal.x);
  let gy = Math.round(goal.y);

  if (sx === gx && sy === gy) return [];

  // If goal tile itself is unwalkable, pick closest walkable neighbor
  if (!isTileWalkable(gx, gy, grid)) {
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      if (isTileWalkable(gx + dx, gy + dy, grid)) {
        gx += dx;
        gy += dy;
        break;
      }
    }
  }

  const open: AStarNode[] = [{ x: sx, y: sy, g: 0, f: Math.abs(sx - gx) + Math.abs(sy - gy) }];
  const closed = new Set<string>();
  const bestG = new Map<string, number>();
  bestG.set(`${sx},${sy}`, 0);

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  let closestNode: AStarNode = open[0];
  let closestDist = Math.abs(sx - gx) + Math.abs(sy - gy);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || a.g - b.g || a.y - b.y || a.x - b.x);
    const current = open.shift()!;
    const key = `${current.x},${current.y}`;

    if (current.x === gx && current.y === gy) {
      return reconstructPath(current);
    }

    closed.add(key);

    const dist = Math.abs(current.x - gx) + Math.abs(current.y - gy);
    if (dist < closestDist) {
      closestDist = dist;
      closestNode = current;
    }

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nKey = `${nx},${ny}`;
      if (closed.has(nKey) || !isTileWalkable(nx, ny, grid)) continue;

      // Prefer roads/stone floors slightly for natural pathing
      const tileKind = grid[ny][nx];
      const stepCost = tileKind === TileKind.Road || tileKind === TileKind.StoneFloor || tileKind === TileKind.Bridge ? 0.95 : 1.0;
      const tentativeG = current.g + stepCost;

      const prevG = bestG.get(nKey);
      if (prevG === undefined || tentativeG < prevG) {
        bestG.set(nKey, tentativeG);
        const h = Math.abs(nx - gx) + Math.abs(ny - gy);
        open.push({
          x: nx,
          y: ny,
          g: tentativeG,
          f: tentativeG + h,
          parent: current,
        });
      }
    }
  }

  return reconstructPath(closestNode);
}

function reconstructPath(node: AStarNode): Tile[] {
  const path: Tile[] = [];
  let curr: AStarNode | undefined = node;
  while (curr && curr.parent) {
    path.unshift(makeTile(curr.x, curr.y));
    curr = curr.parent;
  }
  return path;
}
