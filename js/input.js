// ─── Input Manager ────────────────────────────────────────────────────────────
// Tracks keyboard state, mouse position/clicks, and touch (mobile) controls.

import { CANVAS_W, CANVAS_H } from './config.js';

export const J_RADIUS = 55;
export const S_RADIUS = 32;

// Dynamic joystick positions — adapt to portrait (500×800) or landscape (900×600)
export const getLBase = () => CANVAS_H > CANVAS_W
  ? { x: Math.round(CANVAS_W * 0.20), y: CANVAS_H - 80 }   // portrait: (100, 720)
  : { x: 120,                          y: CANVAS_H - 80 };  // landscape: (120, 520)
export const getRBase = () => CANVAS_H > CANVAS_W
  ? { x: Math.round(CANVAS_W * 0.80), y: CANVAS_H - 80 }   // portrait: (400, 720)
  : { x: CANVAS_W - 120,              y: CANVAS_H - 80 };   // landscape: (780, 520)
export const getSBase = () => CANVAS_H > CANVAS_W
  ? { x: Math.round(CANVAS_W * 0.80), y: CANVAS_H - 180 }  // portrait: (400, 620)
  : { x: CANVAS_W - 120,              y: CANVAS_H - 180 };  // landscape: (780, 420)

export class Input {
  constructor(canvas) {
    this.keys   = {};           // currently held keys
    this.mouse  = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.clicks = [];           // queued mouse clicks { x, y, worldX, worldY }
    this.superPressed = false;  // true once per Space press

    this._canvas = canvas;

    // ── Touch state ──────────────────────────────────────────────────────────
    this._leftTouch  = null;   // { id, baseX, baseY, thumbX, thumbY }
    this._rightTouch = null;
    this._superTap   = false;

    // ── Keyboard listeners ────────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        this.superPressed = true;
      }
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    // ── Mouse listeners ───────────────────────────────────────────────────────
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top)  * scaleY;
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top)  * scaleY;
      this.clicks.push({ x, y, worldX: 0, worldY: 0 });
    });

    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // ── Touch listeners ───────────────────────────────────────────────────────
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      for (const t of e.changedTouches) {
        const cx = (t.clientX - rect.left) * scaleX;
        const cy = (t.clientY - rect.top)  * scaleY;
        const lb = getLBase(), rb = getRBase(), sb = getSBase();
        const dL = Math.hypot(cx - lb.x, cy - lb.y);
        const dR = Math.hypot(cx - rb.x, cy - rb.y);
        const dS = Math.hypot(cx - sb.x, cy - sb.y);
        if (dS <= S_RADIUS) {
          this._superTap = true;
        } else if (dL <= J_RADIUS * 1.5 && (!this._rightTouch || dL < dR)) {
          this._leftTouch = { id: t.identifier, baseX: lb.x, baseY: lb.y, thumbX: cx, thumbY: cy };
        } else if (dR <= J_RADIUS * 1.5) {
          this._rightTouch = { id: t.identifier, baseX: rb.x, baseY: rb.y, thumbX: cx, thumbY: cy };
          // Queue a click so on-screen buttons (PLAY, etc.) also work via touch
          this.clicks.push({ x: cx, y: cy, worldX: 0, worldY: 0 });
        } else {
          // Taps outside joystick zones still register as clicks (for UI screens)
          this.clicks.push({ x: cx, y: cy, worldX: 0, worldY: 0 });
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      for (const t of e.changedTouches) {
        const cx = (t.clientX - rect.left) * scaleX;
        const cy = (t.clientY - rect.top)  * scaleY;
        if (this._leftTouch && t.identifier === this._leftTouch.id) {
          this._leftTouch.thumbX = cx;
          this._leftTouch.thumbY = cy;
        }
        if (this._rightTouch && t.identifier === this._rightTouch.id) {
          this._rightTouch.thumbX = cx;
          this._rightTouch.thumbY = cy;
        }
      }
    }, { passive: false });

    const _endTouch = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._leftTouch  && t.identifier === this._leftTouch.id)  this._leftTouch  = null;
        if (this._rightTouch && t.identifier === this._rightTouch.id) this._rightTouch = null;
      }
    };
    canvas.addEventListener('touchend',    _endTouch, { passive: false });
    canvas.addEventListener('touchcancel', _endTouch, { passive: false });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _leftDx() {
    if (!this._leftTouch) return 0;
    return (this._leftTouch.thumbX - this._leftTouch.baseX) / J_RADIUS;
  }
  _leftDy() {
    if (!this._leftTouch) return 0;
    return (this._leftTouch.thumbY - this._leftTouch.baseY) / J_RADIUS;
  }

  // Called each frame by main loop to resolve world coords from camera
  update(camX, camY) {
    this.mouse.worldX = this.mouse.x + camX;
    this.mouse.worldY = this.mouse.y + camY;

    for (const click of this.clicks) {
      click.worldX = click.x + camX;
      click.worldY = click.y + camY;
    }
  }

  // Consume and return all queued clicks
  flushClicks() {
    const c = this.clicks;
    this.clicks = [];
    return c;
  }

  // Consume the super press flag (keyboard Space or Super button tap)
  consumeSuper() {
    const v = this.superPressed || this._superTap;
    this.superPressed = false;
    this._superTap    = false;
    return v;
  }

  // ── Directional getters (keyboard on desktop, joystick on mobile) ─────────
  get left()  {
    return this.isMobile ? this._leftDx() < -0.2 : !!(this.keys['KeyA'] || this.keys['ArrowLeft']);
  }
  get right() {
    return this.isMobile ? this._leftDx() >  0.2 : !!(this.keys['KeyD'] || this.keys['ArrowRight']);
  }
  get up()    {
    return this.isMobile ? this._leftDy() < -0.2 : !!(this.keys['KeyW'] || this.keys['ArrowUp']);
  }
  get down()  {
    return this.isMobile ? this._leftDy() >  0.2 : !!(this.keys['KeyS'] || this.keys['ArrowDown']);
  }

  // True while right joystick is held (mobile shoot)
  get touchShooting() { return !!this._rightTouch; }

  // Aim angle from right joystick drag (null if not active)
  get rightAngle() {
    if (!this._rightTouch) return null;
    const dx = this._rightTouch.thumbX - this._rightTouch.baseX;
    const dy = this._rightTouch.thumbY - this._rightTouch.baseY;
    if (Math.hypot(dx, dy) < 8) return null;   // dead-zone
    return Math.atan2(dy, dx);
  }

  // Evaluated fresh each frame so DevTools emulation toggled after load is detected
  get isMobile() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  // Touch state snapshot for HUD rendering
  get touchState() {
    return { left: this._leftTouch, right: this._rightTouch };
  }

  // True while mouse button is held (use canvas mousedown/mouseup tracking)
  get shooting() { return this._mouseDown; }
}
