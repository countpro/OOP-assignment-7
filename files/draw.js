/* ═══════════════════════════════════════════════════
   draw.js — 렌더링 전담 모듈
═══════════════════════════════════════════════════ */

/* ── 메인 드로우 루프 ── */
function draw() {
  cx.fillStyle = '#05101f';
  cx.fillRect(0, 0, W, H);

  /* 별 */
  cx.save();
  for (let i = 0; i < 90; i++) {
    const px = ((i * 139.7 + cam.x * 0.04) % W + W) % W;
    const py = ((i * 83.1  + cam.y * 0.025) % H + H) % H;
    cx.globalAlpha = 0.12 + ((i * 37) % 10) / 50;
    cx.fillStyle = '#fff';
    cx.fillRect(px, py, 1 + ((i*7)%3)*0.4, 1 + ((i*7)%3)*0.4);
  }
  cx.restore();

  cx.save();
  cx.translate(-cam.x, -cam.y);

  /* 사망선 표시 (빨간 점선) */
  const deathLine = cam.y + H + 40;
  cx.strokeStyle = 'rgba(255,60,60,0.25)';
  cx.lineWidth = 2; cx.setLineDash([10, 8]);
  cx.beginPath(); cx.moveTo(cam.x, deathLine); cx.lineTo(cam.x + W, deathLine); cx.stroke();
  cx.setLineDash([]);

  /* 코인 */
  coins.forEach(c => {
    if (c.done) return;
    if (c.x - cam.x < -20 || c.x - cam.x > W + 20) return;
    cx.save(); cx.translate(c.x, c.y); cx.rotate(frame * 0.06);
    cx.fillStyle = '#ffd700'; cx.shadowColor = '#ffd700'; cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(0, 0, c.r, 0, Math.PI*2); cx.fill();
    cx.shadowBlur = 0; cx.fillStyle = '#b85e00';
    cx.font = 'bold 9px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('★', 0, 0.5);
    cx.restore();
  });

  /* 장애물 */
  obs.forEach(o => {
    if (o.x - cam.x < -60 || o.x - cam.x > W + 60) return;
    cx.save(); cx.translate(o.x, o.y);
    if (o.type === 'spike') drawSpike(o.phase);
    else if (o.type === 'blade') { cx.rotate(o.rot); drawBlade(); }
    else if (o.type === 'laser') drawLaser(o);
    cx.restore();
  });

  /* 훅 포인트 */
  hooks.forEach(h => {
    if (!h.alive) return;
    if (h.x - cam.x < -60 || h.x - cam.x > W + 60) return;
    cx.save(); cx.translate(h.x, h.y);
    const s = 0.82 + h.pulse * 0.36;
    cx.scale(s, s);
    if (h.glow) { cx.shadowColor = h.glow; cx.shadowBlur = 16; }
    cx.fillStyle = h.color;
    cx.beginPath(); cx.arc(0, 0, h.r, 0, Math.PI*2); cx.fill();
    cx.strokeStyle = 'rgba(255,255,255,0.3)'; cx.lineWidth = 1.5; cx.stroke();
    cx.shadowBlur = 0;
    const icons = { normal:'🪲', gold:'⭐', turbo:'🔥', ice:'❄️', moving:'🌀' };
    cx.font = `bold ${h.r - 1}px sans-serif`;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(icons[h.type] || '●', 0, 0.5);
    cx.restore();
  });

  /* 혀 */
  if (P.mode === 'swing') {
    cx.save();
    cx.strokeStyle = '#ff77c0'; cx.lineWidth = 3; cx.lineCap = 'round';
    cx.setLineDash([7, 5]);
    cx.beginPath(); cx.moveTo(P.x, P.y); cx.lineTo(P.hkX, P.hkY); cx.stroke();
    cx.setLineDash([]);
    cx.fillStyle = '#ffaadd';
    cx.beginPath(); cx.arc(P.hkX, P.hkY, 5, 0, Math.PI*2); cx.fill();
    cx.restore();
  }

  /* 파티클 */
  parts.forEach(p => {
    cx.globalAlpha = Math.max(0, p.life / 38);
    cx.fillStyle = p.col;
    cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI*2); cx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.vx *= 0.97; p.life--;
  });
  parts = parts.filter(p => p.life > 0);
  cx.globalAlpha = 1;

  /* 개구리 */
  drawFrog();

  /* 무적 시간 표시 (부활 후 2초) */
  if (invincibleT > 0) {
    const ratio = invincibleT / INVINCIBLE_FRAMES;
    cx.save();
    cx.translate(P.x - cam.x, P.y - cam.y);
    /* 무적 링 */
    cx.strokeStyle = `rgba(255,220,100,${0.5 * ratio})`;
    cx.lineWidth = 3;
    cx.shadowColor = '#ffc93c';
    cx.shadowBlur = 12 * ratio;
    cx.beginPath();
    cx.arc(0, 0, PLAYER_R + 14 + Math.sin(frame * 0.2) * 3, 0, Math.PI * 2);
    cx.stroke();
    cx.shadowBlur = 0;
    /* 카운트다운 텍스트 */
    const sec = (invincibleT / 60).toFixed(1);
    cx.globalAlpha = ratio * 0.85;
    cx.font = 'bold 11px sans-serif';
    cx.fillStyle = '#ffc93c';
    cx.textAlign = 'center';
    cx.fillText(`무적 ${sec}s`, 0, -PLAYER_R - 22);
    cx.restore();
  }

  /* 쉴드 */
  if (P.shield) {
    cx.save();
    cx.strokeStyle = '#4ecdc4'; cx.lineWidth = 3;
    cx.globalAlpha = 0.45 + 0.32 * Math.sin(frame * 0.14);
    cx.shadowColor = '#4ecdc4'; cx.shadowBlur = 14;
    cx.beginPath(); cx.arc(P.x, P.y, PLAYER_R + 10, 0, Math.PI*2); cx.stroke();
    cx.restore();
  }

  /* 플로팅 텍스트 */
  floatTxts.forEach(t => {
    cx.globalAlpha = Math.max(0, t.life / 78);
    cx.font = 'bold 15px sans-serif'; cx.textAlign = 'center';
    cx.fillStyle = t.col; cx.shadowColor = t.col; cx.shadowBlur = 5;
    cx.fillText(t.txt, t.x, t.y);
    cx.shadowBlur = 0;
    t.y += t.vy; t.life--;
  });
  floatTxts = floatTxts.filter(t => t.life > 0);
  cx.globalAlpha = 1;

  cx.restore();

  /* 피격 플래시 */
  if (damCD > 72) {
    cx.fillStyle = `rgba(255,0,0,${((damCD - 72) / 18) * 0.26})`;
    cx.fillRect(0, 0, W, H);
  }

  /* 속도 감 — 빠르면 모션블러 힌트 (측면 그라데이션) */
  if (P.vx > 14) {
    const alpha = Math.min((P.vx - 14) / 10, 0.18);
    const g2 = cx.createLinearGradient(W * 0.6, 0, W, 0);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, `rgba(20,40,80,${alpha})`);
    cx.fillStyle = g2; cx.fillRect(0, 0, W, H);
  }

  /* HUD 갱신 */
  document.getElementById('scoreTxt').textContent = score + 'm';
  document.getElementById('bestTxt').textContent  = best  + 'm';

  /* 콤보 */
  const cEl = document.getElementById('comboEl');
  if (combo >= 3) { cEl.textContent = `🔥 ${combo}x 콤보!`; cEl.style.opacity = '1'; }
  else cEl.style.opacity = '0';
}

/* ── 개구리 ── */
function drawFrog() {
  /* 무적 중 깜빡임: 부활 무적(invincibleT) 또는 피격 무적(damCD) */
  if (invincibleT > 0) {
    /* 부활 무적: 빠른 깜빡임 */
    if (Math.floor(invincibleT / 4) % 2 === 0) return;
  } else if (damCD > 0 && Math.floor(damCD / 6) % 2 === 0) {
    /* 피격 무적: 느린 깜빡임 */
    return;
  }
  cx.save();
  cx.translate(P.x, P.y);
  const ang = P.mode === 'swing'
    ? Math.atan2(P.hkY - P.y, P.hkX - P.x) + Math.PI / 2
    : Math.atan2(P.vy, P.vx) + Math.PI / 2;
  cx.rotate(ang);
  const s = P.boosted ? 1.18 : 1;
  cx.scale(s, s);
  cx.fillStyle = P.boosted ? '#aaff44' : '#50d468';
  cx.beginPath(); cx.ellipse(0, 2, 13, 11, 0, 0, Math.PI*2); cx.fill();
  cx.fillStyle = '#b8ffc0';
  cx.beginPath(); cx.ellipse(0, 4, 7, 6, 0, 0, Math.PI*2); cx.fill();
  cx.fillStyle = '#fff';
  cx.beginPath(); cx.arc(-5.5, -7, 4.5, 0, Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc( 5.5, -7, 4.5, 0, Math.PI*2); cx.fill();
  cx.fillStyle = '#111';
  cx.beginPath(); cx.arc(-5.5, -7, 2.2, 0, Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc( 5.5, -7, 2.2, 0, Math.PI*2); cx.fill();
  cx.strokeStyle = '#267a36'; cx.lineWidth = 1.5;
  cx.beginPath(); cx.arc(0, -2, 4, 0.2, Math.PI - 0.2); cx.stroke();
  cx.restore();
}

/* ── 장애물 드로우 ── */
function drawSpike(phase) {
  const bob = Math.sin(phase * 2) * 3;
  cx.save(); cx.translate(0, bob);
  cx.fillStyle = '#ff4500'; cx.shadowColor = '#ff4500'; cx.shadowBlur = 10;
  for (let i = 0; i < 4; i++) {
    cx.save(); cx.rotate(i * Math.PI / 2);
    cx.beginPath(); cx.moveTo(0, -19); cx.lineTo(5.5, 0); cx.lineTo(-5.5, 0); cx.closePath(); cx.fill();
    cx.restore();
  }
  cx.restore();
}

function drawBlade() {
  cx.fillStyle = '#b8d8ff'; cx.shadowColor = '#90c8ff'; cx.shadowBlur = 8;
  for (let i = 0; i < 3; i++) {
    cx.save(); cx.rotate(i * Math.PI * 2 / 3);
    cx.beginPath(); cx.moveTo(0, -22); cx.lineTo(7, -4); cx.lineTo(0, 0); cx.lineTo(-7, -4); cx.closePath(); cx.fill();
    cx.restore();
  }
  cx.fillStyle = '#334'; cx.shadowBlur = 0;
  cx.beginPath(); cx.arc(0, 0, 5, 0, Math.PI*2); cx.fill();
}

function drawLaser(o) {
  if (!o.on) {
    cx.strokeStyle = 'rgba(255,0,80,0.18)'; cx.lineWidth = 2; cx.setLineDash([5, 9]);
    cx.beginPath(); cx.moveTo(-o.w/2, 0); cx.lineTo(o.w/2, 0); cx.stroke(); cx.setLineDash([]);
  } else {
    cx.strokeStyle = '#ff0050'; cx.lineWidth = 6; cx.shadowColor = '#ff0050'; cx.shadowBlur = 22;
    cx.beginPath(); cx.moveTo(-o.w/2, 0); cx.lineTo(o.w/2, 0); cx.stroke();
    cx.lineWidth = 2; cx.strokeStyle = '#fff'; cx.shadowBlur = 0;
    cx.beginPath(); cx.moveTo(-o.w/2, 0); cx.lineTo(o.w/2, 0); cx.stroke();
  }
}
