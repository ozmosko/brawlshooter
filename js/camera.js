import { CANVAS_W, CANVAS_H, MAP_W, MAP_H, CAM_LERP } from './config.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  // Smoothly follow a target world position (centre of target)
  follow(targetX, targetY, dt) {
    const targetCamX = targetX - CANVAS_W / 2;
    const targetCamY = targetY - CANVAS_H / 2;

    this.x += (targetCamX - this.x) * CAM_LERP;
    this.y += (targetCamY - this.y) * CAM_LERP;

    // Clamp to map bounds
    this.x = Math.max(0, Math.min(this.x, MAP_W - CANVAS_W));
    this.y = Math.max(0, Math.min(this.y, MAP_H - CANVAS_H));
  }

  // Apply camera transform to ctx
  begin(ctx) {
    ctx.save();
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  end(ctx) {
    ctx.restore();
  }

  // Convert screen → world
  toWorld(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  }

  // Convert world → screen
  toScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}
