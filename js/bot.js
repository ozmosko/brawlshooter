import { TILE, BOT_LOS_RANGE, BOT_SHOOT_RANGE, BOT_SUPER_HP_THRESH } from './config.js';

// ─── Bot Controller ────────────────────────────────────────────────────────────
// Attaches to a Character and drives it each frame.

export class Bot {
  constructor(character, difficulty) {
    this.char       = character;
    this.difficulty = difficulty;   // { pathRecalc, aimSpread, reactionDelay, speedMult }

    this._path       = [];      // [{col,row}, ...]
    this._pathTimer  = 0;       // time until next path recalc
    this._reactionTimer = 0;    // countdown before bot shoots after spotting player
    this._seenPlayer = false;   // currently has LOS to player
    this._wanderAngle = Math.random() * Math.PI * 2;
  }

  update(dt, player, gameMap, game) {
    const ch = this.char;
    if (!ch.alive || !player.alive) return;

    // Apply bullet-time slow
    const speedScale = game.bulletTimeActive
      ? this.difficulty.speedMult * 0.3
      : this.difficulty.speedMult;

    const dx = player.x - ch.x;
    const dy = player.y - ch.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    // ── Line of Sight check ────────────────────────────────────────────────
    const hasLOS = distToPlayer < BOT_LOS_RANGE &&
      gameMap.hasLOS(ch.x, ch.y, player.x, player.y);

    // Check if any decoy is closer (bots are partially fooled by decoys)
    let targetX = player.x;
    let targetY = player.y;
    if (game.decoys.length > 0) {
      const closest = _closestDecoy(game.decoys, ch.x, ch.y);
      if (closest && closest.dist < distToPlayer * 0.6) {
        // Bot targets decoy instead
        targetX = closest.x;
        targetY = closest.y;
      }
    }

    // ── Pathfinding ────────────────────────────────────────────────────────
    this._pathTimer -= dt;
    if (this._pathTimer <= 0) {
      this._pathTimer = this.difficulty.pathRecalc;
      this._path = gameMap.findPath(ch.x, ch.y, targetX, targetY);
    }

    // ── Movement ───────────────────────────────────────────────────────────
    if (hasLOS && distToPlayer < BOT_SHOOT_RANGE) {
      // Stop moving (stand and shoot)
      // Slight lateral strafe for medium/hard
      if (this.difficulty.aimSpread < 0.25) {
        const strafeAngle = Math.atan2(dy, dx) + Math.PI / 2;
        const strafe = Math.sin(Date.now() / 600) * ch.speed * speedScale;
        const sx = Math.cos(strafeAngle) * strafe * dt;
        const sy = Math.sin(strafeAngle) * strafe * dt;
        this._moveBy(sx, sy, gameMap);
      }
    } else {
      // Follow path
      this._followPath(dt, speedScale, gameMap);
    }

    // ── Aiming & Shooting ──────────────────────────────────────────────────
    if (hasLOS) {
      if (!this._seenPlayer) {
        this._seenPlayer = true;
        this._reactionTimer = this.difficulty.reactionDelay;
      }

      // Aim toward player with spread
      const aimAngle = Math.atan2(player.y - ch.y, player.x - ch.x);
      const spread = (Math.random() - 0.5) * this.difficulty.aimSpread;
      ch.angle = aimAngle + spread;

      // Wait for reaction delay before shooting
      if (this._reactionTimer > 0) {
        this._reactionTimer -= dt;
      } else if (distToPlayer < BOT_SHOOT_RANGE && ch.canFire()) {
        // Apply difficulty fire-rate throttle: only fire on some frames
        if (Math.random() < this.difficulty.fireRateMult) {
          const saved = ch.damageMult;
          ch.damageMult = saved * this.difficulty.damageMult;
          const projectiles = ch.fire(ch.angle);
          ch.damageMult = saved;
          game.projectiles.push(...projectiles);
          game.audio.playShoot(ch.type);
        } else {
          // Still consume the cooldown so timing feels realistic
          ch.fireCooldown = 1 / ch.fireRate;
        }
      }
    } else {
      this._seenPlayer = false;
      this._reactionTimer = this.difficulty.reactionDelay;

      // Face movement direction
      if (this._path.length > 0) {
        const next = this._path[0];
        const ndx = (next.col * TILE + TILE / 2) - ch.x;
        const ndy = (next.row * TILE + TILE / 2) - ch.y;
        ch.angle = Math.atan2(ndy, ndx);
      }
    }

    // ── Super usage ────────────────────────────────────────────────────────
    if (ch.superMeter >= 1) {
      const hpFrac = ch.hp / ch.maxHp;
      // Use Super when low HP, or when player is in range
      if (hpFrac < BOT_SUPER_HP_THRESH || (hasLOS && distToPlayer < BOT_SHOOT_RANGE)) {
        ch.activateSuper(game);
      }
    }
  }

  _followPath(dt, speedScale, gameMap) {
    const ch = this.char;
    if (this._path.length === 0) {
      // Wander
      this._wanderAngle += (Math.random() - 0.5) * 0.3;
      const spd = ch.speed * speedScale * 0.5;
      this._moveBy(Math.cos(this._wanderAngle) * spd * dt,
                   Math.sin(this._wanderAngle) * spd * dt, gameMap);
      return;
    }

    const next = this._path[0];
    const targetX = next.col * TILE + TILE / 2;
    const targetY = next.row * TILE + TILE / 2;
    const dx = targetX - ch.x;
    const dy = targetY - ch.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) {
      this._path.shift();
      return;
    }

    const spd = ch.speed * speedScale;
    const moveDist = Math.min(spd * dt, dist);
    this._moveBy((dx / dist) * moveDist, (dy / dist) * moveDist, gameMap);
  }

  _moveBy(dx, dy, gameMap) {
    const ch = this.char;
    let nx = ch.x + dx;
    let ny = ch.y + dy;
    const resolved = gameMap.resolveCircle(nx, ny, ch.radius);
    ch.x = resolved.x;
    ch.y = resolved.y;
  }
}

function _closestDecoy(decoys, x, y) {
  let closest = null, minDist = Infinity;
  for (const d of decoys) {
    const dist = Math.sqrt((d.x - x) ** 2 + (d.y - y) ** 2);
    if (dist < minDist) { minDist = dist; closest = { ...d, dist }; }
  }
  return closest;
}
