// ─── Input Manager ────────────────────────────────────────────────────────────
// Tracks keyboard state and mouse position/clicks.

export class Input {
  constructor(canvas) {
    this.keys   = {};           // currently held keys
    this.mouse  = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.clicks = [];           // queued mouse clicks { x, y, worldX, worldY }
    this.superPressed = false;  // true once per Space press

    this._canvas = canvas;

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

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.clicks.push({ x, y, worldX: 0, worldY: 0 });
    });

    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());
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

  // Consume the super press flag
  consumeSuper() {
    const v = this.superPressed;
    this.superPressed = false;
    return v;
  }

  get left()  { return !!(this.keys['KeyA'] || this.keys['ArrowLeft']); }
  get right() { return !!(this.keys['KeyD'] || this.keys['ArrowRight']); }
  get up()    { return !!(this.keys['KeyW'] || this.keys['ArrowUp']); }
  get down()  { return !!(this.keys['KeyS'] || this.keys['ArrowDown']); }

  // True while mouse button is held (use canvas mousedown/mouseup tracking)
  get shooting() { return this._mouseDown; }
}
