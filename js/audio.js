// ─── Audio Manager (Web Audio API, no external files) ─────────────────────────

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._masterGain = null;
    this._musicStarted = false;
  }

  // Must be called after a user gesture (click/tap)
  init() {
    if (this._ctx) {
      // iOS can suspend the context again; resume on every interaction
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return;
    }
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.4;
      this._masterGain.connect(this._ctx.destination);
      // Mobile browsers start AudioContext suspended even inside a gesture handler
      this._ctx.resume().catch(() => {});
    } catch (e) {
      this._enabled = false;
    }
    this._startMusic();
  }

  // Load music through Web Audio API so it respects the already-unlocked AudioContext
  // (HTMLAudioElement has its own separate autoplay policy that blocks on mobile)
  _startMusic() {
    if (this._musicStarted) return;
    this._musicStarted = true;
    fetch('Avalon_Audio_-_Bulldog_Strut_Main.mp3')
      .then(r => r.arrayBuffer())
      .then(buf => {
        if (!this._ctx) return;
        // Use callback form — universally supported (Promise form missing on old iOS Safari)
        return new Promise((resolve, reject) => {
          this._ctx.decodeAudioData(buf, resolve, reject);
        });
      })
      .then(decoded => {
        if (!decoded || !this._ctx) return;
        const src = this._ctx.createBufferSource();
        src.buffer = decoded;
        src.loop = true;
        const gain = this._ctx.createGain();
        gain.gain.value = 0.30;
        src.connect(gain);
        gain.connect(this._masterGain);
        src.start(0);
      })
      .catch(err => console.warn('Music load failed:', err));
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  _tone(freq, type, duration, gainVal = 0.3, freqEnd = null) {
    if (!this._enabled || !this._ctx) return;
    try {
      const ac = this._ctx;
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, ac.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + duration);
    } catch (_) {}
  }

  _noise(duration, gainVal = 0.15) {
    if (!this._enabled || !this._ctx) return;
    try {
      const ac = this._ctx;
      const bufLen = ac.sampleRate * duration;
      const buffer = ac.createBuffer(1, bufLen, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

      const source = ac.createBufferSource();
      source.buffer = buffer;

      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(gainVal, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain);
      source.start();
      source.stop(ac.currentTime + duration);
    } catch (_) {}
  }

  // ─── Public sound effects ──────────────────────────────────────────────────

  playShoot(type) {
    if (!this._enabled || !this._ctx) return;
    switch (type) {
      case 'tank':
        // Shotgun — wide noise burst
        this._noise(0.09, 0.25);
        this._tone(120, 'sawtooth', 0.08, 0.2, 60);
        break;
      case 'sniper':
        // High-pitched crack
        this._noise(0.05, 0.18);
        this._tone(800, 'sawtooth', 0.06, 0.18, 200);
        break;
      case 'speedster':
        // Rapid pew
        this._tone(600, 'square', 0.06, 0.12, 300);
        break;
      case 'grenadier':
        // Thump
        this._tone(90, 'sine', 0.12, 0.3, 50);
        this._noise(0.07, 0.1);
        break;
      default:
        this._noise(0.07, 0.2);
    }
  }

  playHit() {
    this._tone(440, 'sine', 0.06, 0.2, 300);
  }

  playDeath() {
    this._tone(400, 'sawtooth', 0.08, 0.3, 100);
    setTimeout(() => this._tone(180, 'sine', 0.3, 0.2, 60), 100);
  }

  playSuper() {
    // Ascending arpeggio
    if (!this._enabled || !this._ctx) return;
    const notes = [261, 329, 392, 523];
    notes.forEach((freq, i) => {
      setTimeout(() => this._tone(freq, 'sine', 0.12, 0.25), i * 60);
    });
  }

  playPickup() {
    this._tone(880, 'sine', 0.08, 0.15, 1100);
  }

  playVictory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._tone(freq, 'triangle', 0.18, 0.3), i * 90);
    });
  }

  playDefeat() {
    this._tone(300, 'sawtooth', 0.4, 0.25, 80);
  }
}
