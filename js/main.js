import {
  CANVAS_W, CANVAS_H, TILE, CHAR_KEYS, CHAR_DEFS, DIFFICULTY, SCREEN,
  PICKUP_COUNT,
} from './config.js';
import { GameMap }       from './map.js';
import { Camera }        from './camera.js';
import { Input }         from './input.js';
import { createCharacter } from './character.js';
import {
  updateProjectiles, drawProjectiles,
  updateEffects, drawEffects,
  updateDecoys, drawDecoys,
} from './projectile.js';
import { Bot }           from './bot.js';
import { Pickup, updatePickups } from './pickup.js';
import { AudioManager }  from './audio.js';
import {
  drawHUD, drawRadar, drawMenuScreen, drawCharSelectScreen,
  drawBotCountScreen, drawDiffSelectScreen, drawGameOverScreen, drawKillFeed,
  menuHitTest, charSelectHitTest, botCountHitTest, diffSelectHitTest, gameOverHitTest, quitHitTest,
} from './ui.js';

// ─── Canvas setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

// ─── Core systems ─────────────────────────────────────────────────────────────
const audio  = new AudioManager();
const camera = new Camera();
const input  = new Input(canvas);

// ─── Game State ───────────────────────────────────────────────────────────────
let screen         = SCREEN.MENU;
let selectedChar   = null;
let selectedBotCount = 3;  // default 3 bots
let selectedDiff   = null;

// Hover state for UI
let hoverTarget = null;

// In-game state (reset on each new game)
let gameMap, player, bots, allChars;
let projectiles, effects, decoys, pickups;
let killFeedEvents;
let startTime, gameEndTime;
let bulletTimeActive = false;
let bulletTimeTimer  = 0;

// ─── Shared game context passed to characters/bots ────────────────────────────
const game = {
  projectiles: null,
  effects:     null,
  decoys:      null,
  map:         null,
  audio,

  // Bullet Time Super state
  get bulletTimeActive() { return bulletTimeActive; },
  set bulletTimeActive(v) { bulletTimeActive = v; },
  get bulletTimeTimer()  { return bulletTimeTimer; },
  set bulletTimeTimer(v) { bulletTimeTimer = v; },

  spawnExplosion(x, y, r) {
    this.effects.push({ type: 'explosion', x, y, radius: r, timer: 0.5, maxTimer: 0.5 });
  },
  spawnHitEffect(x, y) {
    this.effects.push({ type: 'hit', x, y, timer: 0.25, maxTimer: 0.25 });
  },
};

// ─── Start a new game ─────────────────────────────────────────────────────────
function startGame() {
  // Generate map
  gameMap = new GameMap();
  gameMap.generate();
  game.map = gameMap;

  projectiles = [];
  effects     = [];
  decoys      = [];
  killFeedEvents = [];
  game.projectiles = projectiles;
  game.effects     = effects;
  game.decoys      = decoys;

  bulletTimeActive = false;
  bulletTimeTimer  = 0;

  // Spawn corners: index 0 = player, 1-3 = bots
  const corners = gameMap.spawnCorners;
  const spawnPos = (idx) => ({
    x: corners[idx].col * TILE + TILE / 2,
    y: corners[idx].row * TILE + TILE / 2,
  });

  // Player
  const p0 = spawnPos(0);
  player = createCharacter(selectedChar, p0.x, p0.y, true);
  player.isPlayer = true;

  // Bots: pick `selectedBotCount` random types (can repeat if count > available types)
  const availableTypes = CHAR_KEYS.filter(k => k !== selectedChar);
  _shuffle(availableTypes);
  const botTypePool = [];
  while (botTypePool.length < selectedBotCount) {
    botTypePool.push(...availableTypes);
  }
  const botTypes = botTypePool.slice(0, selectedBotCount);

  const diff = DIFFICULTY[selectedDiff];
  bots = botTypes.map((type, i) => {
    const pos = spawnPos(Math.min(i + 1, gameMap.spawnCorners.length - 1));
    const ch  = createCharacter(type, pos.x, pos.y, false);
    return new Bot(ch, diff);
  });

  allChars = [player, ...bots.map(b => b.char)];

  // Pickups
  pickups = gameMap.pickupPositions.map(p => new Pickup(p.x, p.y));

  // Camera — centre on player immediately
  camera.x = player.x - CANVAS_W / 2;
  camera.y = player.y - CANVAS_H / 2;

  startTime = performance.now();
}

// ─── Mouse move for hover ─────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (screen === SCREEN.MENU) {
    hoverTarget = menuHitTest(mx, my);
  } else if (screen === SCREEN.CHAR_SEL) {
    const hit = charSelectHitTest(mx, my, selectedChar);
    hoverTarget = hit ? hit.key || hit.type : null;
  } else if (screen === SCREEN.BOT_COUNT) {
    const hit = botCountHitTest(mx, my);
    // Drag slider while held
    if (_mouseHeld && typeof hit === 'number') selectedBotCount = hit;
    hoverTarget = hit === 'confirm' ? 'confirm' : null;
  } else if (screen === SCREEN.DIFF_SEL) {
    hoverTarget = diffSelectHitTest(mx, my);
  } else if (screen === SCREEN.GAME_OVER) {
    hoverTarget = gameOverHitTest(mx, my);
  }
});

// ─── Mouse down — fire/UI clicks ──────────────────────────────────────────────
let _mouseHeld = false;
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  audio.init();  // Unlock audio on first interaction (also starts music)

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Quit to menu from game screen — check BEFORE setting _mouseHeld
  if (screen === SCREEN.GAME && quitHitTest(mx, my)) {
    screen = SCREEN.MENU;
    _mouseHeld = false;
    return;
  }

  _mouseHeld = true;

  if (screen === SCREEN.MENU) {
    if (menuHitTest(mx, my) === 'play') {
      screen = SCREEN.CHAR_SEL;
      selectedChar = null;
      hoverTarget = null;
    }
  } else if (screen === SCREEN.CHAR_SEL) {
    const hit = charSelectHitTest(mx, my, selectedChar);
    if (hit) {
      if (hit.type === 'card') {
        selectedChar = hit.key;
      } else if (hit.type === 'confirm' && selectedChar) {
        screen = SCREEN.BOT_COUNT;
        hoverTarget = null;
      }
    }
  } else if (screen === SCREEN.BOT_COUNT) {
    const hit = botCountHitTest(mx, my);
    if (hit === 'confirm') {
      screen = SCREEN.DIFF_SEL;
      hoverTarget = null;
    } else if (typeof hit === 'number') {
      selectedBotCount = hit;
    }
  } else if (screen === SCREEN.DIFF_SEL) {
    const diff = diffSelectHitTest(mx, my);
    if (diff) {
      selectedDiff = diff;
      startGame();
      screen = SCREEN.GAME;
      hoverTarget = null;
    }
  } else if (screen === SCREEN.GAME_OVER) {
    const hit = gameOverHitTest(mx, my);
    if (hit === 'restart') {
      startGame();
      screen = SCREEN.GAME;
    } else if (hit === 'menu') {
      screen = SCREEN.MENU;
    }
  }
});
canvas.addEventListener('mouseup', e => { if (e.button === 0) _mouseHeld = false; });

// ─── Main Loop ────────────────────────────────────────────────────────────────
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);  // cap at 50ms
  lastTime = now;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (screen === SCREEN.GAME) {
    updateGame(dt);
    renderGame();
  } else if (screen === SCREEN.MENU) {
    drawMenuScreen(ctx, hoverTarget === 'play');
  } else if (screen === SCREEN.CHAR_SEL) {
    drawCharSelectScreen(ctx, hoverTarget, selectedChar);
  } else if (screen === SCREEN.BOT_COUNT) {
    drawBotCountScreen(ctx, selectedBotCount, hoverTarget === 'confirm');
  } else if (screen === SCREEN.DIFF_SEL) {
    drawDiffSelectScreen(ctx, hoverTarget);
  } else if (screen === SCREEN.GAME_OVER) {
    renderGame();   // show frozen game behind overlay
    const won = player.alive;
    const elapsed = (gameEndTime - startTime) / 1000;
    drawGameOverScreen(ctx, won,
      { kills: player.kills, damageDealt: player.damageDealt, survivalTime: elapsed },
      hoverTarget === 'restart', hoverTarget === 'menu');
  }

  requestAnimationFrame(loop);
}

// ─── Game Update ──────────────────────────────────────────────────────────────
function updateGame(dt) {
  // ── Bullet time global timer ─────────────────────────────────────────────
  if (bulletTimeActive) {
    bulletTimeTimer -= dt;
    if (bulletTimeTimer <= 0) {
      bulletTimeActive = false;
      bulletTimeTimer  = 0;
    }
  }

  // ── Player update ────────────────────────────────────────────────────────
  if (player.alive) {
    player.update(dt);
    _handlePlayerInput(dt);
  }

  // ── Bot updates ──────────────────────────────────────────────────────────
  for (const bot of bots) {
    bot.char.update(dt);
    if (bot.char.alive) bot.update(dt, player, gameMap, game);
  }

  // ── Projectiles ──────────────────────────────────────────────────────────
  updateProjectiles(projectiles, allChars, gameMap, dt, game);

  // ── Pickups ──────────────────────────────────────────────────────────────
  updatePickups(pickups, allChars, dt, game);

  // ── Effects & decoys ─────────────────────────────────────────────────────
  updateEffects(effects, dt);
  updateDecoys(decoys, dt);

  // ── Kill feed events ─────────────────────────────────────────────────────
  for (let i = killFeedEvents.length - 1; i >= 0; i--) {
    killFeedEvents[i].timer -= dt;
    if (killFeedEvents[i].timer <= 0) killFeedEvents.splice(i, 1);
  }

  // Track kill feed
  for (const ch of allChars) {
    if (!ch.alive && !ch._deathFed) {
      ch._deathFed = true;
      const killerName = _findKiller(ch);
      killFeedEvents.push({
        text: `${killerName} eliminated ${ch.name}`,
        color: ch.isPlayer ? '#e74c3c' : '#aaa',
        timer: 3,
      });
    }
  }

  // ── Camera ───────────────────────────────────────────────────────────────
  camera.follow(player.x, player.y, dt);
  input.update(camera.x, camera.y);

  // ── Win/Loss check ───────────────────────────────────────────────────────
  const aliveBots = bots.filter(b => b.char.alive).length;
  if (!player.alive || aliveBots === 0) {
    gameEndTime = performance.now();
    screen = SCREEN.GAME_OVER;
  }
}

function _handlePlayerInput(dt) {
  // Movement
  let vx = 0, vy = 0;
  if (input.left)  vx -= 1;
  if (input.right) vx += 1;
  if (input.up)    vy -= 1;
  if (input.down)  vy += 1;

  if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

  const spd = player.speed * player.speedMult;
  const nx  = player.x + vx * spd * dt;
  const ny  = player.y + vy * spd * dt;

  const resolved = gameMap.resolveCircle(nx, ny, player.radius);
  player.x = resolved.x;
  player.y = resolved.y;

  // Aim toward mouse
  const mouseWorld = input.mouse;
  player.angle = Math.atan2(mouseWorld.worldY - player.y, mouseWorld.worldX - player.x);

  // Shoot (hold LMB)
  if (_mouseHeld && player.canFire()) {
    const projs = player.fire(player.angle);
    projectiles.push(...projs);
    audio.playShoot(player.type);
  }

  // Super
  if (input.consumeSuper()) {
    player.activateSuper(game);
  }
}

// ─── Game Render ──────────────────────────────────────────────────────────────
function renderGame() {
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  camera.begin(ctx);

  // Map
  gameMap.draw(ctx, camera.x, camera.y);

  // Decoys
  drawDecoys(ctx, decoys);

  // Pickups
  for (const p of pickups) p.draw(ctx);

  // Effects (below characters)
  drawEffects(ctx, effects);

  // Projectiles
  drawProjectiles(ctx, projectiles);

  // Characters
  for (const ch of allChars) ch.draw(ctx);

  camera.end(ctx);

  // HUD
  const aliveBots = bots.filter(b => b.char.alive).length;
  drawHUD(ctx, player, aliveBots, selectedBotCount, DIFFICULTY[selectedDiff], bulletTimeActive, game);
  drawRadar(ctx, player, allChars);
  drawKillFeed(ctx, killFeedEvents);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function _findKiller(deadChar) {
  // Simple: find last character who damaged them (not tracked precisely)
  // Just return "Unknown" — kill feed already shows who died
  return 'Bot';
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
requestAnimationFrame(loop);
