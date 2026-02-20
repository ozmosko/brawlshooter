import {
  CHAR_DEFS, WEAPON_DEFS, COLOR,
  SUPER_PASSIVE_RATE, SUPER_DAMAGE_BONUS,
  HP_REGEN_RATE, TILE, MAP_W, MAP_H,
} from './config.js';

// ─── Base Character ────────────────────────────────────────────────────────────
export class Character {
  constructor(type, x, y, isPlayer = false) {
    const def = CHAR_DEFS[type];
    this.type     = type;
    this.name     = def.name;
    this.color    = def.color;
    this.isPlayer = isPlayer;

    this.x = x;
    this.y = y;
    this.angle = 0;   // radians, direction character faces

    this.maxHp = def.hp;
    this.hp    = def.hp;
    this.speed = def.speed;
    this.radius = def.radius;

    this.weapon   = def.weapon;
    this.fireRate = def.fireRate;     // shots/second
    this.fireCooldown = 0;

    // Super
    this.superMeter = 0;  // 0..1
    this.superActive = false;
    this.superTimer  = 0;

    // Status effects
    this.speedMult  = 1;
    this.damageMult = 1;
    this.statusTimers = { speed: 0, damage: 0 };

    // Shield (Tank Super)
    this.shieldActive = false;
    this.shieldTimer  = 0;

    // Decoy reference (Speedster Super)
    this.decoy = null;

    // Stats
    this.kills       = 0;
    this.damageDealt = 0;
    this.alive       = true;
    this.deathTime   = 0;
  }

  get weaponDef() { return WEAPON_DEFS[this.weapon]; }

  // ─── Update ─────────────────────────────────────────────────────────────────
  update(dt) {
    if (!this.alive) return;

    // Passive HP regen
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + HP_REGEN_RATE * dt);
    }

    // Super meter passive fill
    if (this.superMeter < 1) {
      this.superMeter = Math.min(1, this.superMeter + SUPER_PASSIVE_RATE * dt);
    }

    // Fire cooldown
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // Status timers
    for (const key of ['speed', 'damage']) {
      if (this.statusTimers[key] > 0) {
        this.statusTimers[key] -= dt;
        if (this.statusTimers[key] <= 0) {
          this.statusTimers[key] = 0;
          if (key === 'speed')  this.speedMult  = 1;
          if (key === 'damage') this.damageMult = 1;
        }
      }
    }

    // Shield timer
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shieldActive = false;
    }

    // Super timer (Bullet Time / Speedster decoy)
    if (this.superActive) {
      this.superTimer -= dt;
      if (this.superTimer <= 0) this.superActive = false;
    }
  }

  canFire() {
    return this.alive && this.fireCooldown <= 0;
  }

  fire(angle) {
    if (!this.canFire()) return [];
    this.fireCooldown = 1 / this.fireRate;
    return this._spawnProjectiles(angle);
  }

  _spawnProjectiles(baseAngle) {
    const wDef = this.weaponDef;
    const projectiles = [];
    const dmg = wDef.damage * this.damageMult;

    for (let i = 0; i < wDef.pellets; i++) {
      let angle = baseAngle;
      if (wDef.pellets > 1) {
        // Evenly distribute across spread
        const step = wDef.spread / (wDef.pellets - 1);
        angle += -wDef.spread / 2 + step * i;
      } else {
        angle += (Math.random() - 0.5) * wDef.spread;
      }

      projectiles.push({
        x: this.x + Math.cos(angle) * (this.radius + wDef.radius + 2),
        y: this.y + Math.sin(angle) * (this.radius + wDef.radius + 2),
        vx: Math.cos(angle) * wDef.speed,
        vy: Math.sin(angle) * wDef.speed,
        speed: wDef.speed,
        damage: dmg,
        range: wDef.range,
        distTraveled: 0,
        radius: wDef.radius,
        color: wDef.color,
        aoe: !!wDef.aoe,
        aoeRadius: wDef.aoeRadius || 0,
        owner: this,
        alive: true,
      });
    }
    return projectiles;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    const actual = this.shieldActive ? amount * 0.2 : amount;
    this.hp -= actual;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  applyDamageDealt(amount) {
    this.damageDealt += amount;
    this.superMeter = Math.min(1, this.superMeter + amount * SUPER_DAMAGE_BONUS);
  }

  // Called when player/AI wants to use Super
  activateSuper(game) {
    if (this.superMeter < 1) return false;
    this.superMeter = 0;
    this._doSuper(game);
    return true;
  }

  _doSuper(game) { /* overridden by subclass */ }

  applyHpPickup(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  applySpeedPickup(mult, duration) {
    this.speedMult = mult;
    this.statusTimers.speed = duration;
  }

  applyDamagePickup(mult, duration) {
    this.damageMult = mult;
    this.statusTimers.damage = duration;
  }

  applySuperCharge() {
    this.superMeter = 1;
  }

  // ─── Drawing ────────────────────────────────────────────────────────────────
  draw(ctx) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    this._drawSprite(ctx);

    // Shield glow
    if (this.shieldActive) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.SHIELD;
      ctx.fill();
    }

    ctx.restore();

    // HP bar (world-space, above character)
    this._drawHpBar(ctx);
  }

  _drawHpBar(ctx) {
    const barW = 36, barH = 5;
    const bx = this.x - barW / 2;
    const by = this.y - this.radius - 12;
    ctx.fillStyle = COLOR.HP_BAR_BG;
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = this.hp / this.maxHp > 0.3 ? COLOR.HP_BAR_FG : '#e74c3c';
    ctx.fillRect(bx, by, barW * (this.hp / this.maxHp), barH);
    // Player indicator dot
    if (this.isPlayer) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y - this.radius - 18, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawSprite(ctx) { /* overridden */ }
}

// ─── Shared sprite helpers ────────────────────────────────────────────────────
// Draw cartoon eyes at given offsets (in local rotated space).
// eyeX/eyeY is the center between the two eyes; gap is half-distance between them.
function _drawEyes(ctx, r, eyeX, eyeYTop, eyeYBot, eyeRx, eyeRy, pupilR, pupilOffX, brows, browColor) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(eyeX, eyeYTop, eyeRx, eyeRy, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(eyeX, eyeYBot, eyeRx, eyeRy, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(eyeX + pupilOffX, eyeYTop, pupilR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeX + pupilOffX, eyeYBot,  pupilR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(eyeX + pupilOffX - pupilR * 0.4, eyeYTop - pupilR * 0.5, pupilR * 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeX + pupilOffX - pupilR * 0.4, eyeYBot  - pupilR * 0.5, pupilR * 0.38, 0, Math.PI * 2); ctx.fill();
  if (brows) {
    ctx.fillStyle = browColor;
    ctx.save(); ctx.translate(eyeX - r * 0.06, eyeYTop - eyeRy - r * 0.12); ctx.rotate(brows); ctx.fillRect(-eyeRx, 0, eyeRx * 2, r * 0.1); ctx.restore();
    ctx.save(); ctx.translate(eyeX - r * 0.06, eyeYBot + eyeRy + r * 0.02); ctx.rotate(-brows); ctx.fillRect(-eyeRx, 0, eyeRx * 2, r * 0.1); ctx.restore();
  }
}

// ─── Tank ──────────────────────────────────────────────────────────────────────
export class Tank extends Character {
  constructor(x, y, isPlayer) { super('tank', x, y, isPlayer); }

  _doSuper(game) {
    this.shieldActive = true;
    this.shieldTimer  = 3;
    game.audio.playSuper();
  }

  _drawSprite(ctx) {
    const r = this.radius;  // 17
    const ol = this.isPlayer ? COLOR.PLAYER_OUTLINE : COLOR.BOT_OUTLINE;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(3, 4, r + 1, r * 0.68, 0, 0, Math.PI * 2); ctx.fill();

    // Twin shotgun barrels (drawn first, behind body)
    ctx.fillStyle = '#606060';
    ctx.fillRect(r * 0.52, -r * 0.35, r * 1.45, r * 0.22); // upper barrel
    ctx.fillRect(r * 0.52,  r * 0.13, r * 1.45, r * 0.22); // lower barrel
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(r * 1.78, -r * 0.42, r * 0.22, r * 0.84); // muzzle block

    // White/red outline ring
    ctx.fillStyle = ol;
    ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.fill();

    // Main body circle (dark red base)
    ctx.fillStyle = '#b01e10';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // Body color highlight (brighter red, shifted back-top)
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(-r * 0.14, -r * 0.14, r * 0.80, 0, Math.PI * 2); ctx.fill();

    // Helmet visor arc (dark cap on top = -y side in local space)
    ctx.fillStyle = '#680808';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, -Math.PI * 0.74, -Math.PI * 0.26);
    ctx.closePath();
    ctx.fill();

    // Visor glow slit (bright blue strip)
    ctx.fillStyle = '#44ddff';
    ctx.fillRect(r * 0.06, -r * 0.84, r * 0.54, r * 0.13);

    // Shoulder pads (small arcs on the +y and -y sides)
    ctx.fillStyle = '#c0281a';
    ctx.beginPath(); ctx.arc(-r * 0.1, -(r + 2), r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.1,   r + 2,  r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(-r * 0.1, -(r + 2), r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.1,   r + 2,  r * 0.28, 0, Math.PI * 2); ctx.fill();

    // Eyes (angry — brows tilted inward toward nose)
    _drawEyes(ctx, r, r * 0.15, -r * 0.30, r * 0.30, r * 0.28, r * 0.24, r * 0.13, r * 0.12, -0.28, '#500000');
  }
}

// ─── Sniper ───────────────────────────────────────────────────────────────────
export class Sniper extends Character {
  constructor(x, y, isPlayer) { super('sniper', x, y, isPlayer); }

  _doSuper(game) {
    game.bulletTimeActive = true;
    game.bulletTimeTimer  = 3;
    game.audio.playSuper();
  }

  _drawSprite(ctx) {
    const r = this.radius;  // 13
    const ol = this.isPlayer ? COLOR.PLAYER_OUTLINE : COLOR.BOT_OUTLINE;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(2, 3, r, r * 0.60, 0, 0, Math.PI * 2); ctx.fill();

    // Very long rifle barrel (extends far forward)
    ctx.fillStyle = '#28363f';
    ctx.fillRect(r * 0.45, -r * 0.13, r * 3.4, r * 0.26); // main barrel
    ctx.fillStyle = '#3e5060';
    ctx.fillRect(r * 0.45, -r * 0.09, r * 0.85, r * 0.18); // stock
    // Scope box on top of barrel
    ctx.fillStyle = '#1a252f';
    ctx.fillRect(r * 1.1, -r * 0.37, r * 0.72, r * 0.30);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(r * 1.46, -r * 0.22, r * 0.12, 0, Math.PI * 2); ctx.fill();
    // Muzzle
    ctx.fillStyle = '#111';
    ctx.fillRect(r * 3.62, -r * 0.20, r * 0.20, r * 0.40);

    // Outline ring
    ctx.fillStyle = ol;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, Math.PI * 2); ctx.fill();

    // Body (slightly smaller oval — slim character)
    ctx.fillStyle = '#177a38';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // Color sheen
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.12, r * 0.78, 0, Math.PI * 2); ctx.fill();

    // Sniper hood/brim (dark arc — top of body)
    ctx.fillStyle = '#0e5225';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, -Math.PI * 0.88, -Math.PI * 0.12);
    ctx.closePath();
    ctx.fill();
    // Brim stripe (lighter accent)
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(r * 0.05, -r * 0.98, r * 0.48, r * 0.13);

    // Eyes (calm, narrowed — focused look)
    // Use narrow ellipse pupils for a "squinting" feel
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(r * 0.10, -r * 0.26, r * 0.28, r * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.10,  r * 0.26, r * 0.28, r * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1a0a';
    ctx.beginPath(); ctx.ellipse(r * 0.26, -r * 0.26, r * 0.09, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.26,  r * 0.26, r * 0.09, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(r * 0.20, -r * 0.32, r * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.20,  r * 0.20, r * 0.05, 0, Math.PI * 2); ctx.fill();
    // Calm flat eyebrows
    ctx.fillStyle = '#083a18';
    ctx.fillRect(r * 0.00, -r * 0.49, r * 0.30, r * 0.09);
    ctx.fillRect(r * 0.00,  r * 0.12, r * 0.30, r * 0.09);
  }
}

// ─── Speedster ────────────────────────────────────────────────────────────────
export class Speedster extends Character {
  constructor(x, y, isPlayer) {
    super('speedster', x, y, isPlayer);
  }

  _doSuper(game) {
    // Dash 200px in facing direction
    const dx = Math.cos(this.angle) * 200;
    const dy = Math.sin(this.angle) * 200;
    const newX = this.x + dx;
    const newY = this.y + dy;

    // Spawn decoy at current position
    game.decoys.push({
      x: this.x, y: this.y,
      color: this.color,
      radius: this.radius,
      timer: 2,
    });

    // Move to new position (clamp to map)
    this.x = Math.max(this.radius, Math.min(MAP_W - this.radius, newX));
    this.y = Math.max(this.radius, Math.min(MAP_H - this.radius, newY));

    // Resolve wall collision
    const resolved = game.map.resolveCircle(this.x, this.y, this.radius);
    this.x = resolved.x;
    this.y = resolved.y;

    game.audio.playSuper();
  }

  _drawSprite(ctx) {
    const r = this.radius;  // 12
    const ol = this.isPlayer ? COLOR.PLAYER_OUTLINE : COLOR.BOT_OUTLINE;

    // Speed streaks behind the body (-x direction)
    ctx.strokeStyle = 'rgba(255,160,30,0.55)';
    for (let i = 0; i < 3; i++) {
      const ly = (i - 1) * r * 0.42;
      const len = r * (0.85 + i * 0.25);
      ctx.lineWidth = 2 - i * 0.4;
      ctx.beginPath(); ctx.moveTo(-r * 0.45, ly); ctx.lineTo(-r * 0.45 - len, ly); ctx.stroke();
    }
    ctx.lineWidth = 1;

    // SMG barrel (compact, drawn behind body)
    ctx.fillStyle = '#585858';
    ctx.fillRect(r * 0.50, -r * 0.17, r * 1.05, r * 0.34);
    ctx.fillStyle = '#303030';
    ctx.fillRect(r * 1.40, -r * 0.22, r * 0.20, r * 0.44);

    // Outline
    ctx.fillStyle = ol;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, 0, Math.PI * 2); ctx.fill();

    // Body (slightly forward-leaning ellipse)
    ctx.fillStyle = '#ba5608';
    ctx.beginPath(); ctx.ellipse(r * 0.06, 0, r, r * 0.90, 0, 0, Math.PI * 2); ctx.fill();

    // Color sheen
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.ellipse(-r * 0.08, -r * 0.10, r * 0.78, r * 0.70, 0, 0, Math.PI * 2); ctx.fill();

    // Speed lightning bolt stripe (diagonal yellow)
    ctx.fillStyle = '#ffdd22';
    ctx.save();
    ctx.rotate(-0.38);
    ctx.fillRect(-r * 0.06, -r * 0.96, r * 0.20, r * 0.92);
    ctx.restore();

    // Eyes (wide, excited)
    _drawEyes(ctx, r, r * 0.14, -r * 0.27, r * 0.27, r * 0.28, r * 0.25, r * 0.14, r * 0.12, 0.18, '#7a3500');
  }
}

// ─── Grenadier ────────────────────────────────────────────────────────────────
export class Grenadier extends Character {
  constructor(x, y, isPlayer) { super('grenadier', x, y, isPlayer); }

  _doSuper(game) {
    // Fire 5 grenades in a spread
    const angles = [-0.28, -0.14, 0, 0.14, 0.28];
    for (const offset of angles) {
      const a = this.angle + offset;
      const p = this._spawnProjectiles(a);
      game.projectiles.push(...p);
    }
    game.audio.playSuper();
  }

  _drawSprite(ctx) {
    const r = this.radius;  // 15
    const ol = this.isPlayer ? COLOR.PLAYER_OUTLINE : COLOR.BOT_OUTLINE;

    // Drop shadow (wider — heavy character)
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath(); ctx.ellipse(3, 4, r + 3, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();

    // Fat launcher barrel (short and wide)
    ctx.fillStyle = '#3d1a5c';
    ctx.fillRect(r * 0.45, -r * 0.36, r * 1.12, r * 0.72); // barrel body
    ctx.fillStyle = '#5a2080';
    ctx.fillRect(r * 0.45, -r * 0.28, r * 0.46, r * 0.56); // inner highlight
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(r * 1.38, -r * 0.40, r * 0.24, r * 0.80); // muzzle
    // Grenade visible in barrel
    ctx.fillStyle = '#27ae60';
    ctx.beginPath(); ctx.ellipse(r * 0.82, 0, r * 0.20, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();

    // Outline (slightly wider oval — heavy build)
    ctx.fillStyle = ol;
    ctx.beginPath(); ctx.ellipse(0, 0, r + 3.5, r + 2.5, 0, 0, Math.PI * 2); ctx.fill();

    // Body (wide oval)
    ctx.fillStyle = '#6a1e8e';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r, 0, 0, Math.PI * 2); ctx.fill();

    // Color sheen
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.ellipse(-r * 0.12, -r * 0.12, r * 0.85, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();

    // Heavy helmet (flat top arc — wider than sniper)
    ctx.fillStyle = '#38085a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 1.08, -Math.PI * 0.82, -Math.PI * 0.18);
    ctx.closePath();
    ctx.fill();
    // Helmet rim accent
    ctx.strokeStyle = '#b060ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.08, -Math.PI * 0.82, -Math.PI * 0.18); ctx.stroke();
    ctx.lineWidth = 1;
    // Visor glow
    ctx.fillStyle = '#dd55ff';
    ctx.fillRect(-r * 0.06, -r * 0.90, r * 0.58, r * 0.13);

    // Eyes (determined — slight frown, heavy brows)
    _drawEyes(ctx, r, r * 0.10, -r * 0.28, r * 0.28, r * 0.26, r * 0.22, r * 0.12, r * 0.12, -0.22, '#2a003a');
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createCharacter(type, x, y, isPlayer = false) {
  switch (type) {
    case 'tank':      return new Tank(x, y, isPlayer);
    case 'sniper':    return new Sniper(x, y, isPlayer);
    case 'speedster': return new Speedster(x, y, isPlayer);
    case 'grenadier': return new Grenadier(x, y, isPlayer);
    default: throw new Error(`Unknown character type: ${type}`);
  }
}
