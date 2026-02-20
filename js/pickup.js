import {
  COLOR, PICKUP_RADIUS,
  PICKUP_HP_RESTORE, PICKUP_SPEED_MULT, PICKUP_DAMAGE_MULT, PICKUP_DURATION,
} from './config.js';

const TYPES = ['hp', 'speed', 'damage', 'super'];
const TYPE_COLORS = {
  hp:     COLOR.PICKUP_HP,
  speed:  COLOR.PICKUP_SPEED,
  damage: COLOR.PICKUP_DAMAGE,
  super:  COLOR.PICKUP_SUPER,
};
const TYPE_LABELS = { hp: '+HP', speed: 'SPD', damage: 'DMG', super: 'SUP' };

export class Pickup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.type = TYPES[Math.floor(Math.random() * TYPES.length)];
    this.radius = PICKUP_RADIUS;
    this.alive = true;
    this._pulse = Math.random() * Math.PI * 2;  // phase offset for animation
  }

  update(dt) {
    this._pulse += dt * 3;
  }

  checkCollect(character) {
    if (!this.alive || !character.alive) return false;
    const dx = character.x - this.x;
    const dy = character.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < character.radius + this.radius) {
      this._apply(character);
      this.alive = false;
      return true;
    }
    return false;
  }

  _apply(ch) {
    switch (this.type) {
      case 'hp':
        ch.applyHpPickup(PICKUP_HP_RESTORE);
        break;
      case 'speed':
        ch.applySpeedPickup(PICKUP_SPEED_MULT, PICKUP_DURATION);
        break;
      case 'damage':
        ch.applyDamagePickup(PICKUP_DAMAGE_MULT, PICKUP_DURATION);
        break;
      case 'super':
        ch.applySuperCharge();
        break;
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    const pulse = Math.sin(this._pulse) * 3;
    const r = this.radius + pulse;
    const color = TYPE_COLORS[this.type];

    // Glow
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;

    // Outer ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fill
    ctx.fillStyle = color + '55';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TYPE_LABELS[this.type], this.x, this.y);

    ctx.restore();
  }
}

export function updatePickups(pickups, characters, dt, game) {
  for (const pickup of pickups) {
    if (!pickup.alive) continue;
    pickup.update(dt);
    for (const ch of characters) {
      if (pickup.checkCollect(ch)) {
        if (ch.isPlayer) game.audio.playPickup();
        break;
      }
    }
  }
  // Remove dead pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    if (!pickups[i].alive) pickups.splice(i, 1);
  }
}
