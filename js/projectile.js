// ─── Projectile System ────────────────────────────────────────────────────────

export function updateProjectiles(projectiles, characters, gameMap, dt, game) {
  const toRemove = new Set();

  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    if (!p.alive) { toRemove.add(i); continue; }

    // Move
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.distTraveled += p.speed * dt;

    // Range check
    if (p.distTraveled >= p.range) {
      if (p.aoe) _triggerAoe(p, characters, game);
      p.alive = false;
      toRemove.add(i);
      continue;
    }

    // Wall collision
    if (gameMap.isWall(p.x, p.y)) {
      if (p.aoe) _triggerAoe(p, characters, game);
      p.alive = false;
      toRemove.add(i);
      continue;
    }

    // Character collision (skip owner)
    let hit = false;
    for (const ch of characters) {
      if (!ch.alive || ch === p.owner) continue;
      const dx = ch.x - p.x;
      const dy = ch.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ch.radius + p.radius) {
        if (p.aoe) {
          _triggerAoe(p, characters, game);
        } else {
          const dmg = p.damage;
          ch.takeDamage(dmg);
          p.owner.applyDamageDealt(dmg);
          if (!ch.alive && p.owner) {
            p.owner.kills++;
            game.audio.playDeath();
          }
          game.audio.playHit();
          game.spawnHitEffect(p.x, p.y);
        }
        p.alive = false;
        toRemove.add(i);
        hit = true;
        break;
      }
    }
  }

  // Remove dead projectiles (reverse order to keep indices valid)
  const sorted = [...toRemove].sort((a, b) => b - a);
  for (const idx of sorted) projectiles.splice(idx, 1);
}

function _triggerAoe(p, characters, game) {
  const r = p.aoeRadius;
  for (const ch of characters) {
    if (!ch.alive || ch === p.owner) continue;
    const dx = ch.x - p.x;
    const dy = ch.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r + ch.radius) {
      const falloff = 1 - dist / (r + ch.radius);
      const dmg = p.damage * falloff;
      ch.takeDamage(dmg);
      p.owner.applyDamageDealt(dmg);
      if (!ch.alive && p.owner) {
        p.owner.kills++;
        game.audio.playDeath();
      }
      game.audio.playHit();
    }
  }
  game.spawnExplosion(p.x, p.y, r);
}

// ─── Draw Projectiles ─────────────────────────────────────────────────────────
export function drawProjectiles(ctx, projectiles) {
  for (const p of projectiles) {
    if (!p.alive) continue;
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ─── Particle Effects ─────────────────────────────────────────────────────────
export function updateEffects(effects, dt) {
  const toRemove = [];
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].timer -= dt;
    if (effects[i].timer <= 0) toRemove.push(i);
  }
  for (const i of toRemove) effects.splice(i, 1);
}

export function drawEffects(ctx, effects) {
  for (const e of effects) {
    const alpha = Math.max(0, e.timer / e.maxTimer);
    if (e.type === 'explosion') {
      const scale = 1 - e.timer / e.maxTimer;
      const currentR = e.radius * scale;
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.arc(e.x, e.y, currentR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(e.x, e.y, currentR * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (e.type === 'hit') {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 5 * (1 - alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ─── Decoys ───────────────────────────────────────────────────────────────────
export function updateDecoys(decoys, dt) {
  for (let i = decoys.length - 1; i >= 0; i--) {
    decoys[i].timer -= dt;
    if (decoys[i].timer <= 0) decoys.splice(i, 1);
  }
}

export function drawDecoys(ctx, decoys) {
  for (const d of decoys) {
    const alpha = Math.min(1, d.timer);
    ctx.save();
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
