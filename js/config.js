// ─── Canvas & Viewport ───────────────────────────────────────────────────────
export let CANVAS_W = 900;
export let CANVAS_H = 600;
// Called once at startup (before canvas is created) to switch to portrait on mobile
export function initCanvasSize(w, h) { CANVAS_W = w; CANVAS_H = h; }

// ─── Map ─────────────────────────────────────────────────────────────────────
export const TILE  = 64;        // px per cell
export const COLS  = 35;        // maze columns
export const ROWS  = 25;        // maze rows
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;

// ─── Colors ──────────────────────────────────────────────────────────────────
export const COLOR = {
  FLOOR:      '#5ab542',   // bright Brawl Stars grass green
  FLOOR_ALT:  '#52a83a',   // slightly darker grass
  FLOOR_PATH: '#8dba6a',   // lighter path
  WALL:       '#c8860a',   // warm sandy-stone wall
  WALL_DARK:  '#8a5c04',   // wall shadow
  WALL_LIGHT: '#f0aa30',   // wall top highlight
  BG:         '#3a8e28',

  // characters — brighter, more saturated
  TANK:       '#e74c3c',
  SNIPER:     '#27ae60',
  SPEEDSTER:  '#e67e22',
  GRENADIER:  '#8e44ad',
  PLAYER_OUTLINE: '#ffffff',
  BOT_OUTLINE:    '#ff6b6b',

  // pickups
  PICKUP_HP:     '#27ae60',
  PICKUP_SPEED:  '#3498db',
  PICKUP_DAMAGE: '#e74c3c',
  PICKUP_SUPER:  '#f1c40f',

  // UI
  HP_BAR_BG:  '#333',
  HP_BAR_FG:  '#2ecc71',
  SUPER_BG:   '#333',
  SUPER_FG:   '#f39c12',
  HUD_BG:     'rgba(0,0,0,0.55)',
  TEXT_MAIN:  '#ffffff',
  TEXT_DIM:   '#aaaaaa',

  // effects
  EXPLOSION:  '#ff6b35',
  SHIELD:     'rgba(100,180,255,0.35)',
  DECOY:      'rgba(255,165,0,0.45)',
};

// ─── Character Definitions ───────────────────────────────────────────────────
export const CHAR_DEFS = {
  tank: {
    name:       'Tank',
    color:      COLOR.TANK,
    hp:         400,
    speed:      85,
    radius:     17,
    weapon:     'shotgun',
    fireRate:   0.9,       // shots per second
    superName:  'Shield',
    superDesc:  '3s of 80% damage reduction',
  },
  sniper: {
    name:       'Sniper',
    color:      COLOR.SNIPER,
    hp:         160,
    speed:      165,
    radius:     13,
    weapon:     'rifle',
    fireRate:   0.9,
    superName:  'Bullet Time',
    superDesc:  'Slows all bots to 30% speed for 3s',
  },
  speedster: {
    name:       'Speedster',
    color:      COLOR.SPEEDSTER,
    hp:         200,
    speed:      230,
    radius:     12,
    weapon:     'smg',
    fireRate:   7,
    superName:  'Dash',
    superDesc:  'Teleport-dash 200px + leave a decoy',
  },
  grenadier: {
    name:       'Grenadier',
    color:      COLOR.GRENADIER,
    hp:         240,
    speed:      115,
    radius:     15,
    weapon:     'launcher',
    fireRate:   0.65,
    superName:  'Barrage',
    superDesc:  'Fire 5 grenades in a wide spread',
  },
};
export const CHAR_KEYS = Object.keys(CHAR_DEFS);   // ['tank','sniper','speedster','grenadier']

// ─── Weapon Definitions ──────────────────────────────────────────────────────
export const WEAPON_DEFS = {
  shotgun: {
    pellets:    5,
    spread:     0.44,      // radians total spread
    speed:      420,
    damage:     22,
    range:      260,
    radius:     4,
    color:      '#ffdd57',
  },
  rifle: {
    pellets:    1,
    spread:     0,
    speed:      700,
    damage:     115,
    range:      700,
    radius:     4,
    color:      '#57ffd8',
  },
  smg: {
    pellets:    1,
    spread:     0.07,
    speed:      500,
    damage:     14,
    range:      320,
    radius:     3,
    color:      '#ffa657',
  },
  launcher: {
    pellets:    1,
    spread:     0,
    speed:      300,
    damage:     80,
    range:      380,
    radius:     7,
    color:      '#c0392b',
    aoe:        true,
    aoeRadius:  64,
  },
};

// ─── Difficulty Presets ──────────────────────────────────────────────────────
export const DIFFICULTY = {
  easy: {
    label:         'Easy',
    pathRecalc:    2.5,    // seconds between path recalculation
    aimSpread:     0.52,   // radians of random aim error
    reactionDelay: 1.2,    // seconds before bot shoots after spotting player
    speedMult:     0.60,   // bot movement speed multiplier
    damageMult:    0.35,   // bot projectile damage multiplier
    fireRateMult:  0.5,    // bot fire rate multiplier
  },
  medium: {
    label:         'Medium',
    pathRecalc:    1.2,
    aimSpread:     0.26,
    reactionDelay: 0.5,
    speedMult:     0.80,
    damageMult:    0.65,
    fireRateMult:  0.75,
  },
  hard: {
    label:         'Hard',
    pathRecalc:    0.4,
    aimSpread:     0.06,
    reactionDelay: 0.12,
    speedMult:     1.00,
    damageMult:    1.00,
    fireRateMult:  1.00,
  },
};

// ─── Super Meter ─────────────────────────────────────────────────────────────
export const SUPER_PASSIVE_RATE  = 0.04;  // fraction of meter per second (fills in ~25s)
export const SUPER_DAMAGE_BONUS  = 0.004; // fraction added per 1 HP damage dealt

// ─── Health Regen ────────────────────────────────────────────────────────────
export const HP_REGEN_RATE = 1;  // HP per second

// ─── Pickup ──────────────────────────────────────────────────────────────────
export const PICKUP_HP_RESTORE    = 50;
export const PICKUP_SPEED_MULT    = 1.5;
export const PICKUP_DAMAGE_MULT   = 1.5;
export const PICKUP_DURATION      = 5;    // seconds
export const PICKUP_RADIUS        = 12;
export const PICKUP_COUNT         = 18;   // total pickups spawned per map

// ─── Camera ──────────────────────────────────────────────────────────────────
export const CAM_LERP = 0.12;  // smoothing factor

// ─── Bot ─────────────────────────────────────────────────────────────────────
export const BOT_SHOOT_RANGE     = 320;  // px; beyond this bots won't try to shoot
export const BOT_LOS_RANGE       = 420;  // line-of-sight distance
export const BOT_SUPER_HP_THRESH = 0.5;  // use Super when HP < 50% OR at 100%

// ─── Screens ─────────────────────────────────────────────────────────────────
export const SCREEN = {
  MENU:      'menu',
  CHAR_SEL:  'char_sel',
  BOT_COUNT: 'bot_count',
  DIFF_SEL:  'diff_sel',
  GAME:      'game',
  GAME_OVER: 'game_over',
};
