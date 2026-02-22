import { CANVAS_W, CANVAS_H, CHAR_DEFS, CHAR_KEYS, DIFFICULTY, COLOR, SCREEN, MAP_W, MAP_H } from './config.js';
import { getLBase, getRBase, getSBase, J_RADIUS, S_RADIUS } from './input.js';

// ─── HUD (in-game overlay) ────────────────────────────────────────────────────
export function drawHUD(ctx, player, aliveBots, totalBots, difficulty, bulletTimeActive, game) {
  const PAD = 14;

  // ── Left panel: Player info ───────────────────────────────────────────────
  const panelW = 180, panelH = 80;
  ctx.fillStyle = COLOR.HUD_BG;
  _roundRect(ctx, PAD, PAD, panelW, panelH, 8);
  ctx.fill();

  // Character name
  ctx.fillStyle = player.color;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(player.name.toUpperCase(), PAD + 10, PAD + 20);

  // HP bar
  const barX = PAD + 10, barY = PAD + 28;
  const barW = panelW - 20, barH = 10;
  ctx.fillStyle = '#222';
  ctx.fillRect(barX, barY, barW, barH);
  const hpFrac = player.hp / player.maxHp;
  ctx.fillStyle = hpFrac > 0.5 ? '#2ecc71' : hpFrac > 0.25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(barX, barY, barW * hpFrac, barH);
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, barX + 2, barY + 8);

  // Super meter
  const superY = barY + 16;
  ctx.fillStyle = '#222';
  ctx.fillRect(barX, superY, barW, 8);
  ctx.fillStyle = player.superMeter >= 1 ? '#f1c40f' : '#d4840b';
  ctx.fillRect(barX, superY, barW * player.superMeter, 8);
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(player.superMeter >= 1 ? 'SUPER READY! [SPACE]' : 'SUPER', barX + 2, superY + 7);

  // Status effects
  let statusText = '';
  if (player.statusTimers.speed > 0)  statusText += `SPD+  `;
  if (player.statusTimers.damage > 0) statusText += `DMG+  `;
  if (player.shieldActive)             statusText += `SHIELD`;
  if (statusText) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(statusText.trim(), barX, superY + 20);
  }

  // ── Top-right: Enemy count + kill tracker ─────────────────────────────────
  const panelRW = 148, panelRX = CANVAS_W - panelRW - PAD;
  ctx.fillStyle = COLOR.HUD_BG;
  _roundRect(ctx, panelRX, PAD, panelRW, 68, 8);
  ctx.fill();

  // "N ALIVE" line
  ctx.textAlign = 'center';
  const panelCX = panelRX + panelRW / 2;
  ctx.fillStyle = aliveBots === 0 ? '#2ecc71' : '#e74c3c';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`${aliveBots} ALIVE`, panelCX, PAD + 18);

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(panelRX + 10, PAD + 24, panelRW - 20, 1);

  // Kill progress bar background
  ctx.fillStyle = '#222';
  ctx.fillRect(panelRX + 10, PAD + 29, panelRW - 20, 7);
  // Fill (green proportional to kills)
  const killFrac = totalBots > 0 ? player.kills / totalBots : 0;
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(panelRX + 10, PAD + 29, (panelRW - 20) * killFrac, 7);

  // "KILLS X/Y" text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`KILLS ${player.kills}/${totalBots}`, panelCX, PAD + 51);

  // Difficulty badge
  ctx.fillStyle = COLOR.TEXT_DIM;
  ctx.font = '9px monospace';
  ctx.fillText(difficulty.label.toUpperCase(), panelCX, PAD + 64);

  // ── Top-centre: Quit button ───────────────────────────────────────────────
  const qbW = 80, qbH = 26, qbX = CANVAS_W / 2 - qbW / 2, qbY = PAD;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  _roundRect(ctx, qbX, qbY, qbW, qbH, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  _roundRect(ctx, qbX, qbY, qbW, qbH, 6);
  ctx.stroke();
  ctx.fillStyle = '#cccccc';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('← MENU', qbX + qbW / 2, qbY + 17);

  // Bullet time indicator
  if (bulletTimeActive) {
    ctx.fillStyle = 'rgba(100,200,255,0.18)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#57d3ff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BULLET TIME', CANVAS_W / 2, CANVAS_H - 30);
  }
}

// ─── Main Menu ────────────────────────────────────────────────────────────────
export function drawMenuScreen(ctx, hoverPlay, bgImage, bgImageMobile, isMobile) {
  // ── Background image ───────────────────────────────────────────────────────
  // Desktop: wide image (2600×1463) — center-crop to 3:2
  // Mobile:  square image (1024×1024) — top-crop to 3:2 (preserves title)
  const img = (isMobile && bgImageMobile?.complete && bgImageMobile.naturalWidth > 0)
    ? bgImageMobile
    : bgImage;

  if (img && img.complete && img.naturalWidth > 0) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const canvasRatio = CANVAS_W / CANVAS_H;
    let sx, sy, sw, sh;
    if (iw / ih > canvasRatio) {
      // Wider than canvas (desktop): center-crop horizontally
      sh = ih; sw = Math.round(ih * canvasRatio);
      sy = 0;  sx = Math.round((iw - sw) / 2);
    } else {
      // Square or taller (mobile): top-crop to preserve title at top
      sw = iw; sh = Math.round(iw / canvasRatio);
      sx = 0;  sy = 0;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
  } else {
    // Fallback if image not yet loaded
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ── Dark overlay — heavier at bottom for text readability ─────────────────
  const ov = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  ov.addColorStop(0,   'rgba(0,0,0,0.05)');
  ov.addColorStop(0.55,'rgba(0,0,0,0.25)');
  ov.addColorStop(1,   'rgba(0,0,0,0.72)');
  ctx.fillStyle = ov;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Bottom UI panel ────────────────────────────────────────────────────────
  const btnW = 200, btnH = 54;
  const btnX = CANVAS_W / 2 - btnW / 2;
  const btnY = CANVAS_H - 90;          // PLAY slightly above bottom edge

  // Controls hint — above PLAY button (differs by platform)
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#ffffff';
  const hint = isMobile
    ? 'Left stick: move  ·  Right stick: aim & shoot  ·  SUPER button'
    : 'WASD · Mouse aim · Click to shoot · Space for Super';
  ctx.fillText(hint, CANVAS_W / 2, btnY - 36);

  // Subtitle — above controls hint
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('4-Player Top-Down Brawler', CANVAS_W / 2, btnY - 62);

  // PLAY button
  _drawButton(ctx, btnX, btnY, btnW, btnH, '▶  PLAY', hoverPlay, '#f39c12');
}

// ─── Character Select Screen ──────────────────────────────────────────────────
export function drawCharSelectScreen(ctx, hovered, selected) {
  _drawScreenBg(ctx, 'SELECT YOUR BRAWLER');

  const isPortrait = CANVAS_W < 600;

  // Layout params
  let cardW, cardH, getCardPos, bottomY;
  if (isPortrait) {
    // 2×2 grid for portrait (500×800)
    cardW = 218; cardH = 185;
    const gapX = 16, gapY = 16;
    const startX = (CANVAS_W - 2 * cardW - gapX) / 2;
    const startY = 82;
    getCardPos = (i) => ({
      x: startX + (i % 2) * (cardW + gapX),
      y: startY + Math.floor(i / 2) * (cardH + gapY),
    });
    bottomY = startY + 2 * cardH + gapY;  // bottom of 2nd row
  } else {
    // 4-card horizontal row for landscape (900×600)
    cardW = 160; cardH = 200;
    const totalW = CHAR_KEYS.length * cardW + (CHAR_KEYS.length - 1) * 20;
    const startX = (CANVAS_W - totalW) / 2;
    const startY = CANVAS_H / 2 - cardH / 2 - 10;
    getCardPos = (i) => ({ x: startX + i * (cardW + 20), y: startY });
    bottomY = startY + cardH;
  }

  CHAR_KEYS.forEach((key, i) => {
    const def = CHAR_DEFS[key];
    const { x: cx, y: cy } = getCardPos(i);
    const isHovered  = hovered === key;
    const isSelected = selected === key;

    // Card background
    ctx.fillStyle = isSelected ? def.color + 'cc' : isHovered ? '#2c2c5e' : '#1e1e3e';
    _roundRect(ctx, cx, cy, cardW, cardH, 10);
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? def.color : isHovered ? '#6666cc' : '#333';
    ctx.lineWidth = isSelected ? 3 : 1.5;
    _roundRect(ctx, cx, cy, cardW, cardH, 10);
    ctx.stroke();

    // Character preview (mini sprite drawn at card centre)
    ctx.save();
    ctx.translate(cx + cardW / 2, cy + (isPortrait ? 58 : 72));
    ctx.scale(1.8, 1.8);
    _drawMiniChar(ctx, key, def.color);
    ctx.restore();

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name.toUpperCase(), cx + cardW / 2, cy + (isPortrait ? 96 : 118));

    // Stats bar group
    const stats = [
      { label: 'HP',  value: def.hp / 400 },
      { label: 'SPD', value: def.speed / 230 },
      { label: 'DMG', value: WEAPON_DMG_SCORE[key] },
    ];
    const statsY0 = isPortrait ? 108 : 130;
    stats.forEach((s, si) => {
      const sy = cy + statsY0 + si * 18;
      ctx.fillStyle = '#ddd';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, cx + 12, sy + 9);
      ctx.fillStyle = '#444';
      ctx.fillRect(cx + 35, sy, cardW - 47, 10);
      ctx.fillStyle = def.color;
      ctx.fillRect(cx + 35, sy, (cardW - 47) * Math.min(1, s.value), 10);
    });

    // Super name
    ctx.fillStyle = '#f1c40f';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ ${def.superName}`, cx + cardW / 2, cy + cardH - 8);
  });

  // Instruction
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(selected ? 'Tap CONFIRM to continue' : 'Tap a brawler to select', CANVAS_W / 2, bottomY + 26);

  // Confirm button (only if selection made)
  if (selected) {
    _drawButton(ctx, CANVAS_W / 2 - 90, bottomY + 42, 180, 40, 'CONFIRM ▶', true, '#2ecc71');
  }
}

// ─── Difficulty Select Screen ──────────────────────────────────────────────────
export function drawDiffSelectScreen(ctx, hovered) {
  _drawScreenBg(ctx, 'SELECT DIFFICULTY');

  const btnW = 200, btnH = 54, gap = 20;
  const totalH = 3 * btnH + 2 * gap;
  const startY = CANVAS_H / 2 - totalH / 2;
  const x = CANVAS_W / 2 - btnW / 2;

  const diffKeys = Object.keys(DIFFICULTY);
  const diffColors = { easy: '#2ecc71', medium: '#f39c12', hard: '#e74c3c' };

  diffKeys.forEach((key, i) => {
    const def = DIFFICULTY[key];
    const by = startY + i * (btnH + gap);
    const isH = hovered === key;
    _drawButton(ctx, x, by, btnW, btnH, def.label.toUpperCase(), isH, diffColors[key]);
  });

  ctx.fillStyle = '#ccc';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Bots only target you — difficulty affects their accuracy & speed', CANVAS_W / 2, CANVAS_H - 40);
}

// ─── Bot Count Select Screen (slider, 1–12) ───────────────────────────────────
export function drawBotCountScreen(ctx, selectedCount, confirmHovered) {
  _drawScreenBg(ctx, 'NUMBER OF BOTS');

  const STEPS   = 12;
  const TRACK_L = CANVAS_W < 600 ? 40 : 170;   // narrower margin in portrait
  const TRACK_W = CANVAS_W - TRACK_L * 2;
  const TRACK_Y = CANVAS_W < 600 ? 220 : 256;
  const TRACK_H = 12;
  const THUMB_R = 20;

  const fraction = (selectedCount - 1) / (STEPS - 1);
  const thumbX   = TRACK_L + fraction * TRACK_W;
  const thumbCY  = TRACK_Y + TRACK_H / 2;

  // ── Tick marks + step numbers ─────────────────────────────────────────────
  for (let i = 0; i < STEPS; i++) {
    const tx = TRACK_L + (i / (STEPS - 1)) * TRACK_W;
    const active = i < selectedCount;
    ctx.fillStyle = active ? '#f39c12' : '#444';
    ctx.fillRect(tx - 1, TRACK_Y - 20, 2, 14);
    ctx.fillStyle = active ? '#fff' : '#666';
    ctx.font = `${i + 1 === selectedCount ? 'bold ' : ''}10px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(i + 1, tx, TRACK_Y - 25);
  }

  // ── Track background ──────────────────────────────────────────────────────
  ctx.fillStyle = '#2a2a2a';
  _roundRect(ctx, TRACK_L, TRACK_Y, TRACK_W, TRACK_H, 6);
  ctx.fill();

  // ── Active track (left portion) ───────────────────────────────────────────
  if (thumbX > TRACK_L) {
    ctx.fillStyle = '#d4820a';
    _roundRect(ctx, TRACK_L, TRACK_Y, thumbX - TRACK_L, TRACK_H, 6);
    ctx.fill();
  }

  // ── Thumb ─────────────────────────────────────────────────────────────────
  // Outer glow
  ctx.fillStyle = 'rgba(243,156,18,0.25)';
  ctx.beginPath(); ctx.arc(thumbX, thumbCY, THUMB_R + 7, 0, Math.PI * 2); ctx.fill();
  // Dark ring
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.arc(thumbX, thumbCY, THUMB_R + 2, 0, Math.PI * 2); ctx.fill();
  // Orange fill
  ctx.fillStyle = '#f39c12';
  ctx.beginPath(); ctx.arc(thumbX, thumbCY, THUMB_R, 0, Math.PI * 2); ctx.fill();
  // Number inside thumb
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(selectedCount, thumbX, thumbCY + 5);

  // ── Large value display ───────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${selectedCount} BOT${selectedCount > 1 ? 'S' : ''}`, CANVAS_W / 2, TRACK_Y + 80);

  // ── Confirm button ────────────────────────────────────────────────────────
  _drawButton(ctx, CANVAS_W / 2 - 100, TRACK_Y + 108, 200, 48, 'CONFIRM ▶', confirmHovered, '#2ecc71');

  // ── Hint ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Drag slider or click to choose  •  Bot types are randomly assigned', CANVAS_W / 2, CANVAS_H - 28);
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────
export function drawGameOverScreen(ctx, won, stats, hoverRestart, hoverMenu) {
  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const panelW = 380, panelH = 280;
  const px = CANVAS_W / 2 - panelW / 2;
  const py = CANVAS_H / 2 - panelH / 2;

  ctx.fillStyle = '#1a1a2e';
  _roundRect(ctx, px, py, panelW, panelH, 14);
  ctx.fill();
  ctx.strokeStyle = won ? '#f1c40f' : '#e74c3c';
  ctx.lineWidth = 3;
  _roundRect(ctx, px, py, panelW, panelH, 14);
  ctx.stroke();

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = won ? '#f1c40f' : '#e74c3c';
  ctx.shadowBlur = 16;
  ctx.shadowColor = ctx.fillStyle;
  ctx.fillText(won ? 'VICTORY!' : 'DEFEATED', CANVAS_W / 2, py + 44);
  ctx.shadowBlur = 0;

  // Stats
  const statLines = [
    { label: 'Kills',         value: stats.kills },
    { label: 'Damage Dealt',  value: Math.floor(stats.damageDealt) },
    { label: 'Survived',      value: _formatTime(stats.survivalTime) },
  ];

  ctx.font = '14px monospace';
  statLines.forEach((s, i) => {
    const sy = py + 76 + i * 28;
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, px + 40, sy);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(s.value, px + panelW - 40, sy);
  });

  // Buttons
  const btnY = py + panelH - 60;
  _drawButton(ctx, px + 20, btnY, 160, 38, 'PLAY AGAIN', hoverRestart, '#2ecc71');
  _drawButton(ctx, px + panelW - 180, btnY, 160, 38, 'MAIN MENU', hoverMenu, '#3498db');
}

// ─── Radar (bottom-left) ──────────────────────────────────────────────────────
export function drawRadar(ctx, player, allChars, isMobile = false) {
  const PAD = 14;
  const R   = 68;  // radar circle radius
  const cx  = PAD + R;
  // On mobile, sit above the left joystick with a small gap
  const cy  = isMobile ? (getLBase().y - J_RADIUS - 12 - R) : (CANVAS_H - PAD - R);

  // ── Clip everything to the radar circle ──────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // Dark radar background
  ctx.fillStyle = 'rgba(0,14,4,0.88)';
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // Concentric range rings
  ctx.strokeStyle = 'rgba(0,200,60,0.18)';
  ctx.lineWidth = 1;
  for (let ring = R / 3; ring < R; ring += R / 3) {
    ctx.beginPath(); ctx.arc(cx, cy, ring, 0, Math.PI * 2); ctx.stroke();
  }
  // Cross-hair lines
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  // Rotating sweep line + fade trail
  const sweepAngle = (Date.now() / 1200) * Math.PI; // ~1 full rotation per 2.4 s
  const TRAIL = 1.4;  // radians of trailing fade
  // Trail wedge (multiple layers for fade)
  for (let step = 0; step < 6; step++) {
    const a0 = sweepAngle - TRAIL + (step / 6) * TRAIL;
    const a1 = sweepAngle - TRAIL + ((step + 1) / 6) * TRAIL;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a1, false);
    ctx.closePath();
    ctx.fillStyle = `rgba(0,255,80,${(step / 6) * 0.09})`;
    ctx.fill();
  }
  // Sweep line
  ctx.strokeStyle = 'rgba(0,255,80,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
  ctx.stroke();

  ctx.restore(); // end clip

  // ── Scale: fit the full map into the radar circle ─────────────────────────
  // Use the larger dimension so the whole map is always visible
  const scale = (R * 1.82) / Math.max(MAP_W, MAP_H);
  // Map centre in radar coords
  const mapCX = cx + (MAP_W / 2 - MAP_W / 2) * scale; // = cx
  const mapCY = cy + (MAP_H / 2 - MAP_H / 2) * scale; // = cy
  // Helper: world → radar pixel
  const toR = (wx, wy) => ({
    x: cx + (wx - MAP_W / 2) * scale,
    y: cy + (wy - MAP_H / 2) * scale,
  });

  // ── Map border outline (faint) ────────────────────────────────────────────
  const mbl = toR(0,     0);
  const mbr = toR(MAP_W, MAP_H);
  ctx.strokeStyle = 'rgba(0,200,60,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mbl.x, mbl.y, mbr.x - mbl.x, mbr.y - mbl.y);

  // ── Enemies ───────────────────────────────────────────────────────────────
  for (const ch of allChars) {
    if (!ch.alive || ch.isPlayer) continue;
    const { x: rx, y: ry } = toR(ch.x, ch.y);
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    ctx.beginPath(); ctx.arc(rx, ry, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
  }

  // ── Player: triangle pointing in aim direction at their actual map pos ────
  const { x: px, y: py } = toR(player.x, player.y);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.angle);
  // White outer ring so it stands out on any background
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-5,  4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── Outer border ring ─────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,220,80,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;

  // ── Label ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,220,80,0.65)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RADAR', cx, cy + R + 11);
}

// ─── Kill Feed / Notifications ────────────────────────────────────────────────
export function drawKillFeed(ctx, events) {
  const x = CANVAS_W - 14;
  let y = 90;
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  for (const ev of events) {
    const alpha = Math.min(1, ev.timer / 0.5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ev.color || '#fff';
    ctx.fillText(ev.text, x, y);
    y += 18;
  }
  ctx.globalAlpha = 1;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _drawButton(ctx, x, y, w, h, label, hovered, color) {
  ctx.fillStyle = hovered ? color : color + '55';
  _roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  _roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

function _drawScreenBg(ctx, title) {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#0f0c29');
  grad.addColorStop(1, '#302b63');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_W / 2, 52);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 64, CANVAS_W, 2);
}

function _drawMiniChar(ctx, type, color) {
  // Simplified icon for character select cards
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-14, -14, 28, 6);
  // Barrel direction East
  ctx.fillStyle = '#fff';
  ctx.fillRect(10, -2, 10, 4);
}

function _formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Relative weapon damage score for stat display (0..1)
const WEAPON_DMG_SCORE = {
  tank:      (22 * 5) / 200,   // shotgun total
  sniper:    115 / 130,
  speedster: 14 / 130,
  grenadier: 80 / 130,
};

// ─── Hit-testing helpers (called from main.js for button interactions) ─────────
export function menuHitTest(mx, my) {
  const btnW = 200, btnH = 54;
  const bx = CANVAS_W / 2 - btnW / 2;
  const by = CANVAS_H - 90;   // must match drawMenuScreen btnY
  if (mx >= bx && mx <= bx + btnW && my >= by && my <= by + btnH) return 'play';
  return null;
}

export function charSelectHitTest(mx, my, selected) {
  const isPortrait = CANVAS_W < 600;
  let cardW, cardH, getCardPos, bottomY;

  if (isPortrait) {
    cardW = 218; cardH = 185;
    const gapX = 16, gapY = 16;
    const startX = (CANVAS_W - 2 * cardW - gapX) / 2;
    const startY = 82;
    getCardPos = (i) => ({
      x: startX + (i % 2) * (cardW + gapX),
      y: startY + Math.floor(i / 2) * (cardH + gapY),
    });
    bottomY = startY + 2 * cardH + gapY;
  } else {
    cardW = 160; cardH = 200;
    const totalW = CHAR_KEYS.length * cardW + (CHAR_KEYS.length - 1) * 20;
    const startX = (CANVAS_W - totalW) / 2;
    const startY = CANVAS_H / 2 - cardH / 2 - 10;
    getCardPos = (i) => ({ x: startX + i * (cardW + 20), y: startY });
    bottomY = startY + cardH;
  }

  for (let i = 0; i < CHAR_KEYS.length; i++) {
    const { x: cx, y: cy } = getCardPos(i);
    if (mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + cardH) {
      return { type: 'card', key: CHAR_KEYS[i] };
    }
  }

  if (selected) {
    const bx = CANVAS_W / 2 - 90;
    const by = bottomY + 42;
    if (mx >= bx && mx <= bx + 180 && my >= by && my <= by + 40) {
      return { type: 'confirm' };
    }
  }
  return null;
}

export function diffSelectHitTest(mx, my) {
  const btnW = 200, btnH = 54, gap = 20;
  const totalH = 3 * btnH + 2 * gap;
  const startY = CANVAS_H / 2 - totalH / 2;
  const x = CANVAS_W / 2 - btnW / 2;

  const diffKeys = Object.keys(DIFFICULTY);
  for (let i = 0; i < diffKeys.length; i++) {
    const by = startY + i * (btnH + gap);
    if (mx >= x && mx <= x + btnW && my >= by && my <= by + btnH) {
      return diffKeys[i];
    }
  }
  return null;
}

export function botCountHitTest(mx, my) {
  const STEPS   = 12;
  const TRACK_L = CANVAS_W < 600 ? 40 : 170;
  const TRACK_W = CANVAS_W - TRACK_L * 2;
  const TRACK_Y = CANVAS_W < 600 ? 220 : 256;

  // Slider track hit area (generous vertical range)
  if (mx >= TRACK_L - 10 && mx <= TRACK_L + TRACK_W + 10 && my >= 220 && my <= 310) {
    const fraction = Math.max(0, Math.min(1, (mx - TRACK_L) / TRACK_W));
    return Math.round(fraction * (STEPS - 1)) + 1;  // 1..12
  }

  // Confirm button
  const bx = CANVAS_W / 2 - 100, by = TRACK_Y + 108;
  if (mx >= bx && mx <= bx + 200 && my >= by && my <= by + 48) return 'confirm';

  return null;
}

export function quitHitTest(mx, my) {
  const PAD = 14;
  const qbW = 80, qbX = CANVAS_W / 2 - qbW / 2, qbY = PAD;
  return mx >= qbX && mx <= qbX + qbW && my >= qbY && my <= qbY + 26;
}

export function gameOverHitTest(mx, my) {
  const panelW = 380, panelH = 280;
  const px = CANVAS_W / 2 - panelW / 2;
  const py = CANVAS_H / 2 - panelH / 2;
  const btnY = py + panelH - 60;

  if (mx >= px + 20 && mx <= px + 180 && my >= btnY && my <= btnY + 38) return 'restart';
  if (mx >= px + panelW - 180 && mx <= px + panelW - 20 && my >= btnY && my <= btnY + 38) return 'menu';
  return null;
}

// ─── Mobile Touch Controls Overlay ───────────────────────────────────────────
export function drawMobileControls(ctx, touchState, superReady) {
  const drawJoystick = (bx, by, touch) => {
    // Base ring
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(bx, by, J_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(bx, by, J_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Thumb — clamped within base radius
    let tx = bx, ty = by;
    if (touch) {
      const dx = touch.thumbX - touch.baseX;
      const dy = touch.thumbY - touch.baseY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, J_RADIUS);
      const angle = Math.atan2(dy, dx);
      tx = bx + Math.cos(angle) * clamped;
      ty = by + Math.sin(angle) * clamped;
    }
    ctx.save();
    ctx.globalAlpha = touch ? 0.75 : 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(tx, ty, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const lb = getLBase(), rb = getRBase(), sb = getSBase();

  // Left joystick (movement)
  drawJoystick(lb.x, lb.y, touchState.left);

  // Right joystick (aim + shoot)
  drawJoystick(rb.x, rb.y, touchState.right);

  // Super button — glows yellow when ready
  const sbx = sb.x, sby = sb.y, sr = S_RADIUS;
  const superAlpha = superReady ? 0.85 : 0.35;
  ctx.save();
  ctx.globalAlpha = superAlpha;
  ctx.strokeStyle = superReady ? '#ffe000' : '#aaaaaa';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(sbx, sby, sr, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = superReady ? 'rgba(255,220,0,0.22)' : 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(sbx, sby, sr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = superReady ? '#ffe000' : '#cccccc';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SUPER', sbx, sby);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
