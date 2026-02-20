import { TILE, COLS, ROWS, MAP_W, MAP_H, COLOR, PICKUP_COUNT } from './config.js';

// ─── Maze Cell Flags ──────────────────────────────────────────────────────────
// Each cell is a bitmask: which walls have been removed (passage exists)
const N = 0b0001;
const S = 0b0010;
const E = 0b0100;
const W = 0b1000;
const OPPOSITE = { [N]: S, [S]: N, [E]: W, [W]: E };
const DIR_DELTA = {
  [N]: { dc: 0, dr: -1 },
  [S]: { dc: 0, dr:  1 },
  [E]: { dc: 1, dr:  0 },
  [W]: { dc: -1, dr: 0 },
};

export class GameMap {
  constructor() {
    this.cells = null;    // 2D array [row][col] of passage bitmask
    this.pickupPositions = [];
    this.spawnCorners = [];
  }

  generate() {
    this.decorations = [];  // terrain decorations (trees, stones, bushes)
    // Initialize all cells with no passages (all walls intact)
    this.cells = Array.from({ length: ROWS }, () => new Uint8Array(COLS));

    // Recursive backtracking DFS
    const visited = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
    const stack = [];

    const startC = 1, startR = 1;
    visited[startR][startC] = 1;
    stack.push({ c: startC, r: startR });

    while (stack.length) {
      const { c, r } = stack[stack.length - 1];
      const dirs = this._shuffledDirs();
      let moved = false;

      for (const dir of dirs) {
        const { dc, dr } = DIR_DELTA[dir];
        const nc = c + dc * 2;   // skip 2 — cells at odd indices form the maze
        const nr = r + dr * 2;

        // Actually we use a simpler approach: every cell can be a maze node
        const nc2 = c + dc;
        const nr2 = r + dr;

        if (nr2 >= 0 && nr2 < ROWS && nc2 >= 0 && nc2 < COLS && !visited[nr2][nc2]) {
          // carve passage
          this.cells[r][c]     |= dir;
          this.cells[nr2][nc2] |= OPPOSITE[dir];
          visited[nr2][nc2] = 1;
          stack.push({ c: nc2, r: nr2 });
          moved = true;
          break;
        }
      }

      if (!moved) stack.pop();
    }

    // Widen some dead-ends into 2×2 rooms for gameplay feel
    this._addRooms();

    // Compute spawn corners (4 far-apart cells)
    this.spawnCorners = this._computeSpawnCorners();

    // Compute pickup positions (dead-ends and random open cells)
    this.pickupPositions = this._computePickupPositions();

    // Generate terrain decorations
    this._generateDecorations();
  }

  _shuffledDirs() {
    const dirs = [N, S, E, W];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    return dirs;
  }

  _addRooms() {
    // Open walls between adjacent cells every ~8 cells to create open areas
    for (let r = 1; r < ROWS - 2; r += 7) {
      for (let c = 1; c < COLS - 2; c += 7) {
        this.cells[r][c]     |= (S | E);
        this.cells[r][c+1]   |= (S | W);
        this.cells[r+1][c]   |= (N | E);
        this.cells[r+1][c+1] |= (N | W);
      }
    }
  }

  _computeSpawnCorners() {
    const margin = 2;
    return [
      // Index 0 = player spawn: map centre
      { col: Math.floor(COLS / 2), row: Math.floor(ROWS / 2) },
      // Indices 1-4 = bot spawns: four corners
      { col: margin,               row: margin },
      { col: COLS - 1 - margin,   row: margin },
      { col: margin,               row: ROWS - 1 - margin },
      { col: COLS - 1 - margin,   row: ROWS - 1 - margin },
    ];
  }

  _computePickupPositions() {
    // Find dead-end cells (only one passage) and some random open cells
    const deadEnds = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const passages = [N, S, E, W].filter(d => this.cells[r][c] & d).length;
        if (passages === 1) deadEnds.push({ col: c, row: r });
      }
    }

    // Shuffle and pick up to PICKUP_COUNT positions
    for (let i = deadEnds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]];
    }

    return deadEnds.slice(0, PICKUP_COUNT).map(({ col, row }) => ({
      x: col * TILE + TILE / 2,
      y: row * TILE + TILE / 2,
    }));
  }

  _generateDecorations() {
    // Place decorative elements in open cells (not near walls)
    const rng = (min, max) => min + Math.random() * (max - min);
    const types = ['tree', 'stone', 'bush', 'stone'];  // weighted
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const passages = [N, S, E, W].filter(d => this.cells[r][c] & d).length;
        // Only place in open cells (many passages), not in dead-ends
        if (passages >= 3 && Math.random() < 0.12) {
          const cx = c * TILE + TILE / 2;
          const cy = r * TILE + TILE / 2;
          const type = types[Math.floor(Math.random() * types.length)];
          this.decorations.push({
            x: cx + rng(-10, 10),
            y: cy + rng(-10, 10),
            type,
            size: rng(0.7, 1.3),
            rot:  rng(0, Math.PI * 2),
          });
        }
      }
    }
  }

  // Returns true if the given world-pixel rect (AABB) is fully inside open space
  isSolid(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
    return false; // cells themselves are always open; walls are between cells
  }

  // Check whether moving from (x,y) in direction requires wall check
  // Returns true if there's a wall blocking passage from cell (c,r) in direction dir
  hasWall(c, r, dir) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
    return !(this.cells[r][c] & dir);
  }

  // ─── Collision Helpers ──────────────────────────────────────────────────────

  static get WALL_T() { return 8; }  // wall thickness — must match draw pass

  // Returns true if world point (wx, wy) is inside a solid wall
  isWall(wx, wy) {
    if (wx < 0 || wx >= MAP_W || wy < 0 || wy >= MAP_H) return true;
    const col = Math.floor(wx / TILE);
    const row = Math.floor(wy / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
    const W = GameMap.WALL_T;
    const lx = wx - col * TILE;
    const ly = wy - row * TILE;
    // Corner pillars are always solid
    if (lx < W && ly < W) return true;
    if (lx > TILE - W && ly < W) return true;
    if (lx < W && ly > TILE - W) return true;
    if (lx > TILE - W && ly > TILE - W) return true;
    const cell = this.cells[row][col];
    if (ly < W && !(cell & N)) return true;
    if (ly > TILE - W && !(cell & S)) return true;
    if (lx < W && !(cell & W)) return true;
    if (lx > TILE - W && !(cell & E)) return true;
    return false;
  }

  // Resolve circle vs maze walls using precise circle-rect collision.
  // Returns corrected {x, y} position.
  resolveCircle(x, y, radius) {
    const W = GameMap.WALL_T;

    // Hard clamp to map bounds first
    x = Math.max(W + radius, Math.min(MAP_W - W - radius, x));
    y = Math.max(W + radius, Math.min(MAP_H - W - radius, y));

    // Check cells in the 3×3 neighbourhood of the circle's position
    const col0 = Math.max(0, Math.floor((x - radius) / TILE));
    const col1 = Math.min(COLS - 1, Math.floor((x + radius) / TILE));
    const row0 = Math.max(0, Math.floor((y - radius) / TILE));
    const row1 = Math.min(ROWS - 1, Math.floor((y + radius) / TILE));

    for (let r = row0; r <= row1; r++) {
      for (let c = col0; c <= col1; c++) {
        const cell = this.cells[r][c];
        const wx = c * TILE, wy = r * TILE;

        // Test each closed wall face + corner pillars as solid AABB rectangles
        const rects = [];
        if (!(cell & N)) rects.push([wx, wy, TILE, W]);
        if (!(cell & S)) rects.push([wx, wy + TILE - W, TILE, W]);
        if (!(cell & W)) rects.push([wx, wy, W, TILE]);
        if (!(cell & E)) rects.push([wx + TILE - W, wy, W, TILE]);
        // Corner pillars (always solid)
        rects.push([wx, wy, W, W]);
        rects.push([wx + TILE - W, wy, W, W]);
        rects.push([wx, wy + TILE - W, W, W]);
        rects.push([wx + TILE - W, wy + TILE - W, W, W]);

        for (const [rx, ry, rw, rh] of rects) {
          const res = _circleRect(x, y, radius, rx, ry, rw, rh);
          x = res.x; y = res.y;
        }
      }
    }
    return { x, y };
  }

  // ─── A* Pathfinding ─────────────────────────────────────────────────────────

  // Returns array of {col, row} cells from start to goal (grid cells)
  findPath(startX, startY, goalX, goalY) {
    const sc = Math.floor(startX / TILE);
    const sr = Math.floor(startY / TILE);
    const gc = Math.floor(goalX / TILE);
    const gr = Math.floor(goalY / TILE);

    if (sc === gc && sr === gr) return [];

    const key = (c, r) => r * COLS + c;
    const h = (c, r) => Math.abs(c - gc) + Math.abs(r - gr);

    const open = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();

    const startKey = key(sc, sr);
    gScore.set(startKey, 0);
    fScore.set(startKey, h(sc, sr));
    open.set(startKey, { c: sc, r: sr });

    while (open.size > 0) {
      // Pick node with lowest fScore
      let bestKey = null, bestF = Infinity;
      for (const [k] of open) {
        const f = fScore.get(k) ?? Infinity;
        if (f < bestF) { bestF = f; bestKey = k; }
      }

      const { c, r } = open.get(bestKey);
      if (c === gc && r === gr) {
        // Reconstruct path
        const path = [];
        let cur = bestKey;
        while (cameFrom.has(cur)) {
          const { c: pc, r: pr } = open.get(cur) ?? this._keyToCell(cur);
          path.unshift({ col: pc, row: pr });
          cur = cameFrom.get(cur);
        }
        return path;
      }

      open.delete(bestKey);

      const dirs = [N, S, E, W];
      for (const dir of dirs) {
        if (!(this.cells[r][c] & dir)) continue;  // wall blocks this direction
        const { dc, dr } = DIR_DELTA[dir];
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;

        const nKey = key(nc, nr);
        const tentG = (gScore.get(bestKey) ?? Infinity) + 1;
        if (tentG < (gScore.get(nKey) ?? Infinity)) {
          cameFrom.set(nKey, bestKey);
          gScore.set(nKey, tentG);
          fScore.set(nKey, tentG + h(nc, nr));
          if (!open.has(nKey)) open.set(nKey, { c: nc, r: nr });
        }
      }
    }
    return []; // no path
  }

  _keyToCell(k) {
    return { c: k % COLS, r: Math.floor(k / COLS) };
  }

  // Check line-of-sight between two world points (returns true if unobstructed)
  hasLOS(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / (TILE / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isWall(x1 + dx * t, y1 + dy * t)) return false;
    }
    return true;
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  draw(ctx, camX, camY) {
    const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
    const endCol   = Math.min(COLS - 1, Math.ceil((camX + ctx.canvas.width)  / TILE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE) - 1);
    const endRow   = Math.min(ROWS - 1, Math.ceil((camY + ctx.canvas.height) / TILE) + 1);

    const W_T = GameMap.WALL_T;

    // ── Pass 1: Grass floor (Brawl Stars style) ───────────────────────────
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const x = c * TILE;
        const y = r * TILE;

        // Alternating bright green tiles
        ctx.fillStyle = (c + r) % 2 === 0 ? '#5ab542' : '#52a83a';
        ctx.fillRect(x, y, TILE, TILE);

        // Grass blade dashes
        if ((c * 3 + r * 5) % 4 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x + 10, y + 14, 3, 10);
          ctx.fillRect(x + 40, y + 36, 3, 10);
          ctx.fillRect(x + 22, y + 50, 3, 8);
        }
        // Darker spot variation
        if ((c * 7 + r * 3) % 9 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(x + 4, y + 4, 24, 24);
        }
      }
    }

    // ── Pass 2: Walls — Brawl Stars style (solid chunky stone) ───────────
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = this.cells[r][c];

        const drawWall = (wx, wy, ww, wh) => {
          // Main wall body — warm golden stone
          ctx.fillStyle = '#d4982a';
          ctx.fillRect(wx, wy, ww, wh);
          // Top bright highlight (3D top face)
          ctx.fillStyle = '#f5c842';
          ctx.fillRect(wx, wy, ww, 3);
          // Side shadow (right)
          ctx.fillStyle = '#a06c10';
          ctx.fillRect(wx + ww - 3, wy + 3, 3, wh - 3);
          // Bottom shadow
          ctx.fillStyle = '#7a4d08';
          ctx.fillRect(wx, wy + wh - 3, ww, 3);
          // Subtle crack lines
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          if (ww > wh) {
            // Horizontal wall — draw horizontal cracks
            ctx.fillRect(wx + Math.floor(ww * 0.3), wy + 2, 2, wh - 4);
            ctx.fillRect(wx + Math.floor(ww * 0.65), wy + 2, 2, wh - 4);
          } else {
            ctx.fillRect(wx + 2, wy + Math.floor(wh * 0.3), ww - 4, 2);
            ctx.fillRect(wx + 2, wy + Math.floor(wh * 0.65), ww - 4, 2);
          }
        };

        if (!(cell & N)) drawWall(x,              y,              TILE, W_T);
        if (!(cell & S)) drawWall(x,              y + TILE - W_T, TILE, W_T);
        if (!(cell & W)) drawWall(x,              y,              W_T,  TILE);
        if (!(cell & E)) drawWall(x + TILE - W_T, y,              W_T,  TILE);

        // Solid corner blocks — slightly darker
        ctx.fillStyle = '#b87a18';
        ctx.fillRect(x,              y,              W_T, W_T);
        ctx.fillRect(x + TILE - W_T, y,              W_T, W_T);
        ctx.fillRect(x,              y + TILE - W_T, W_T, W_T);
        ctx.fillRect(x + TILE - W_T, y + TILE - W_T, W_T, W_T);
        // Corner highlights
        ctx.fillStyle = '#f0aa30';
        ctx.fillRect(x,              y,              W_T, 2);
        ctx.fillRect(x + TILE - W_T, y,              W_T, 2);
        ctx.fillRect(x,              y + TILE - W_T, W_T, 2);
        ctx.fillRect(x + TILE - W_T, y + TILE - W_T, W_T, 2);
      }
    }

    // ── Pass 3: Terrain decorations ────────────────────────────────────────
    for (const dec of this.decorations) {
      if (dec.x < camX - 40 || dec.x > camX + ctx.canvas.width + 40) continue;
      if (dec.y < camY - 40 || dec.y > camY + ctx.canvas.height + 40) continue;
      this._drawDecoration(ctx, dec);
    }
  }

  _drawDecoration(ctx, dec) {
    const { x, y, type, size, rot } = dec;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    if (type === 'tree') {
      // Trunk
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(-3 * size, -2 * size, 6 * size, 8 * size);
      // Canopy (two layered circles)
      ctx.fillStyle = '#2d7a2d';
      ctx.beginPath();
      ctx.arc(0, -8 * size, 11 * size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a9c3a';
      ctx.beginPath();
      ctx.arc(-2 * size, -10 * size, 8 * size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4dbf4d';
      ctx.beginPath();
      ctx.arc(2 * size, -12 * size, 6 * size, 0, Math.PI * 2);
      ctx.fill();
      // Highlight dot
      ctx.fillStyle = 'rgba(180,255,120,0.3)';
      ctx.beginPath();
      ctx.arc(-3 * size, -13 * size, 3 * size, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'stone') {
      // Main rock
      ctx.fillStyle = '#888070';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 * size, 7 * size, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Smaller rock
      ctx.fillStyle = '#9a9080';
      ctx.beginPath();
      ctx.ellipse(6 * size, 3 * size, 6 * size, 4 * size, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(-3 * size, -2 * size, 4 * size, 2 * size, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'bush') {
      // Cluster of green circles
      const bushColor = ['#2e8b2e', '#3aab3a', '#4cc24c'];
      const offsets = [{ x: 0, y: 0, r: 8 }, { x: -6, y: 2, r: 6 }, { x: 7, y: 1, r: 6 }];
      offsets.forEach((o, i) => {
        ctx.fillStyle = bushColor[i];
        ctx.beginPath();
        ctx.arc(o.x * size, o.y * size, o.r * size, 0, Math.PI * 2);
        ctx.fill();
      });
      // Small flower dots
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(2 * size, -5 * size, 2 * size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ─── Circle vs AABB helper (module-level) ────────────────────────────────────
// Pushes circle centre (cx,cy) with radius r out of rect [rx,ry,rw,rh].
function _circleRect(cx, cy, r, rx, ry, rw, rh) {
  // Find nearest point on rect to circle centre
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  const distSq = dx * dx + dy * dy;

  if (distSq === 0) {
    // Centre is inside rect — push out along smallest overlap axis
    const ol = cx - rx, or_ = rx + rw - cx;
    const ot = cy - ry, ob = ry + rh - cy;
    const m = Math.min(ol, or_, ot, ob);
    if (m === ol)      cx = rx - r;
    else if (m === or_) cx = rx + rw + r;
    else if (m === ot)  cy = ry - r;
    else                cy = ry + rh + r;
  } else if (distSq < r * r) {
    // Overlap — push circle away from nearest surface point
    const dist = Math.sqrt(distSq);
    cx = nearX + (dx / dist) * r;
    cy = nearY + (dy / dist) * r;
  }
  return { x: cx, y: cy };
}
