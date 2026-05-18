/* ═══════════════════════════════════════════════════
   game.js — 게임 로직 전담 모듈
═══════════════════════════════════════════════════ */

/* ── 캔버스 & 상수 ── */
const cv = document.getElementById('c');
const cx = cv.getContext('2d');
const W = 480, H = 780;
const G = 0.42;          // 중력
const PLAYER_R = 17;     // 개구리 반지름
const MAX_VX = 24;       // 최대 수평속도

/* ── 부활 무적 시간: 2초 = 120프레임(60fps 기준) ── */
const INVINCIBLE_FRAMES = 120;

/* ═══════════════════════════════════════════════════
   게임 상태
═══════════════════════════════════════════════════ */
let gState = 'start';
let score = 0;
let best  = parseInt(localStorage.getItem('nhBest') || '0');
let hp    = 3;
let frame = 0;
let combo = 0, comboT = 0;
let damCD = 0;           // 피격 무적 프레임 (피해 후 짧은 무적)
let invincibleT = 0;     // 부활 무적 프레임 (2초)
let lastChunkX = 0;
let lastHookX = 0;       // 마지막으로 잡은 공점의 x 좌표

/* ── 입력 상태 ──
   ★ 버그 수정 (핵심):
     pointerDown을 명시적으로 추적한다.
     - onDown  → pointerDown = true  → tryHook() 1회 호출
     - onUp    → pointerDown = false → release() 호출
     - release()가 armLen 초과 등으로 자동 호출될 때에도,
       pointerDown === true이면 P.mode를 'fly'로만 바꾸고
       새 훅은 잡지 않는다.
     - 오직 pointerDown이 false(손을 뗀 상태)에서 다시 onDown이
       발생해야만 tryHook()으로 새 공을 잡을 수 있다.
── */
let pointerDown = false;

/* ═══════════════════════════════════════════════════
   플레이어
═══════════════════════════════════════════════════ */
let P;
function mkPlayer() {
  return {
    x: 100, y: 340,
    vx: 5, vy: 0,
    mode: 'fly',          // 'fly' | 'swing'
    angle: 0, angVel: 0, armLen: 0,
    hkX: 0, hkY: 0,
    hkRef: null,          // ★ 인덱스 대신 훅 객체 참조 저장
    shield: false, shieldT: 0,
    boosted: false, boostT: 0
  };
}

/* ═══════════════════════════════════════════════════
   카메라
═══════════════════════════════════════════════════ */
let cam = { x: 0, y: 0 };

/* ═══════════════════════════════════════════════════
   엔티티
═══════════════════════════════════════════════════ */
let hooks = [], obs = [], parts = [], coins = [], floatTxts = [];

/* ═══════════════════════════════════════════════════
   초기화
═══════════════════════════════════════════════════ */
function init() {
  score = 0; hp = 3; frame = 0;
  combo = 0; comboT = 0; damCD = 0; invincibleT = 0;
  pointerDown = false;
  lastChunkX = 0; lastHookX = 0;
  P = mkPlayer();
  cam = { x: 0, y: 0 };
  hooks = []; obs = []; parts = []; coins = []; floatTxts = [];
  updateHPUI(false);
  spawnChunk(0);
  spawnChunk(700);
  spawnChunk(1400);
}

/* ═══════════════════════════════════════════════════
   청크 생성
═══════════════════════════════════════════════════ */
function spawnChunk(sx) {
  lastChunkX = Math.max(lastChunkX, sx + 850);
  const progress = Math.min(sx / 10000, 1);
  let x = sx + 80;
  while (x < sx + 850) {
    const minGap = 220 - progress * 40;
    const maxGap = 380 - progress * 60;
    x += minGap + Math.random() * (maxGap - minGap);

    const y = 150 + Math.random() * 320;
    hooks.push(mkHook(x, y, pickType(x)));

    if (x > 500 && Math.random() < 0.28 + progress * 0.15) {
      spawnOb(x + 40 + Math.random() * 100, y + 70 + Math.random() * 150);
    }
    if (Math.random() < 0.42) {
      coins.push({ x: x - 80 - Math.random() * 60, y: y + 50 + Math.random() * 80, r: 9, done: false });
    }
  }
}

function pickType(x) {
  if (x < 350) return 'normal';
  const r = Math.random();
  if (r < .08)  return 'gold';
  if (r < .15)  return 'turbo';
  if (r < .23)  return 'ice';
  if (r < .42)  return 'moving';
  return 'normal';
}

function mkHook(x, y, type) {
  const colors = { normal:'#c8dcff', gold:'#ffd700', turbo:'#ff6b6b', ice:'#4ecdc4', moving:'#ff69b4' };
  const glows  = { gold:'rgba(255,215,0,.5)', turbo:'rgba(255,90,90,.5)', ice:'rgba(78,205,196,.5)', moving:'rgba(255,105,180,.5)' };
  const h = { x, y, type, r: 13, alive: true, phase: Math.random() * Math.PI * 2,
              color: colors[type] || '#ccc', glow: glows[type] || null, pulse: 0 };
  if (type === 'moving') { h.ox = x; h.amp = 45 + Math.random() * 40; h.freq = 0.016 + Math.random() * 0.014; }
  return h;
}

function spawnOb(x, y) {
  const types = ['spike', 'spike', 'blade', 'laser'];
  const t = types[Math.floor(Math.random() * types.length)];
  const o = { x, y, type: t, phase: Math.random() * Math.PI * 2 };
  if (t === 'blade') { o.rot = 0; o.rs = 0.032 + Math.random() * 0.038; }
  if (t === 'laser') { o.w = 65 + Math.random() * 55; o.on = false; o.timer = 0; o.period = 100 + Math.random() * 80; }
  obs.push(o);
}

/* ═══════════════════════════════════════════════════
   입력 처리
   ★ 버그 수정 (핵심):
     pointerDown을 명시적으로 추적한다.
     - onDown  → pointerDown = true  → tryHook() 1회 호출
     - onUp    → pointerDown = false → release() 호출
     - armLen 초과 등으로 release()가 내부에서 자동 호출돼
       P.mode가 'fly'가 되더라도, pointerDown === true이면
       tryHook()이 절대 호출되지 않는다.
     → 꾹 누르고 있는 동안은 새 공으로 이동 불가.
     → 손을 떼고 다시 눌러야만 새 공을 잡는다.
═══════════════════════════════════════════════════ */
function onDown(e) {
  e.preventDefault();
  if (gState !== 'playing') return;
  pointerDown = true;
  tryHook();   // 이벤트 발생 시 딱 1번만 후킹 시도
}

function onUp(e) {
  e.preventDefault();
  pointerDown = false;   // 상태를 먼저 false로 — 이후 release에서 fly 전환
  if (gState !== 'playing') return;
  release();
}

/* ═══════════════════════════════════════════════════
   후킹 (swing 진입)
   ★ 버그 수정 핵심:
     - tryHook()은 P.mode === 'fly' 일 때만 동작.
     - swing 중에는 절대 새 훅을 잡지 않음.
     - 따라서 클릭을 계속 누르고 있어도 swing이 끝나기 전까지
       다음 공으로 자동 이동하지 않음.
     - release() 후 P.mode가 'fly'가 되고 나서
       다시 onDown 이벤트가 발생해야 새 훅을 잡을 수 있음.
═══════════════════════════════════════════════════ */
function tryHook() {
  if (P.mode !== 'fly') return;          // swing 중엔 절대 재후킹 안 함
  if (!pointerDown) return;             // 클릭 중이 아니면 후킹 불가

  let bestIdx = -1, bestD = 1e9;
  hooks.forEach((h, i) => {
    if (!h.alive) return;
    const dx = h.x - P.x, dy = h.y - P.y;
    if (dx < -30) return;         // 뒤쪽 훅 무시
    const d = Math.hypot(dx, dy);
    if (d < 360 && d < bestD) { bestD = d; bestIdx = i; }
  });
  if (bestIdx < 0) return;

  const h = hooks[bestIdx];
  P.hkRef  = h;                         // ★ 객체 참조 저장
  P.hkX    = h.x; P.hkY = h.y;
  lastHookX = h.x;                      // 마지막으로 잡은 공점 x 기록
  P.armLen = Math.max(1, Math.hypot(P.x - h.x, P.y - h.y));
  P.angle  = Math.atan2(P.y - h.y, P.x - h.x);
  /* 현재 속도 → 각속도 변환 */
  P.angVel = (P.vy * Math.cos(P.angle) - P.vx * Math.sin(P.angle)) / P.armLen;
  P.mode   = 'swing';

  /* 퍼펙트 훅 판정 */
  if (bestD < h.r + 20) {
    floatText('PERFECT!', P.x, P.y - 44, '#ffd700');
    burst(h.x, h.y, '#ffd700', 14);
    addCombo();
  }
  applyHookFx(h);
  burst(h.x, h.y, h.color, 7);
}

function applyHookFx(h) {
  switch (h.type) {
    case 'gold':
      P.vx = Math.min(P.vx + 3, MAX_VX);
      floatText('SPEED UP!', P.x, P.y - 40, '#ffd700'); break;
    case 'turbo':
      P.boosted = true; P.boostT = 180;
      P.vx = Math.min(P.vx + 4, MAX_VX);
      floatText('TURBO!!', P.x, P.y - 40, '#ff6b6b');
      burst(P.x, P.y, '#ff6b6b', 18); break;
    case 'ice':
      P.shield = true; P.shieldT = 280;
      floatText('SHIELD!', P.x, P.y - 40, '#4ecdc4'); break;
  }
  h.alive = false;
}

function release() {
  if (P.mode !== 'swing') return;
  /* 각속도 → 선속도 */
  P.vx = -Math.sin(P.angle) * P.angVel * P.armLen;
  P.vy =  Math.cos(P.angle) * P.angVel * P.armLen;
  P.mode  = 'fly';
  P.hkRef = null;
}

/* ═══════════════════════════════════════════════════
   물리 업데이트
═══════════════════════════════════════════════════ */
function updatePlayer() {
  if (P.mode === 'swing') {
    /* 무빙 훅 추적: 인덱스 대신 객체 참조로 안전하게 접근 */
    const hk = P.hkRef;
    if (hk && hk.alive) { P.hkX = hk.x; P.hkY = hk.y; }

    const angAcc = -(G / P.armLen) * Math.sin(P.angle);
    P.angVel += angAcc;
    P.angVel *= 0.998;
    P.angle  += P.angVel;
    P.x = P.hkX + Math.cos(P.angle) * P.armLen;
    P.y = P.hkY + Math.sin(P.angle) * P.armLen;
    if (P.armLen > 480) release();
  } else {
    P.vy += G;
    if (P.boosted) P.vx = Math.min(P.vx * 1.004, MAX_VX);
    P.vx = Math.min(P.vx, MAX_VX);
    P.x += P.vx;
    P.y += P.vy;
  }

  if (P.shieldT > 0) { P.shieldT--; if (!P.shieldT) P.shield = false; }
  if (P.boostT  > 0) { P.boostT--;  if (!P.boostT)  P.boosted = false; }

  /* 거리 점수 */
  const prev = score;
  score = Math.max(score, Math.floor((P.x - 100) / 8));
  if (score > best) best = score;
  if (Math.floor(score / 50) > Math.floor(prev / 50)) burst(P.x, P.y, '#ffd700', 10);

  /* 낙사 판정 */
  if (P.y > cam.y + H + 40) {
    die(true);
  }
}

function updateHooks() {
  hooks.forEach(h => {
    if (!h.alive) return;
    if (h.type === 'moving') {
      h.phase += h.freq;
      h.x = h.ox + Math.sin(h.phase) * h.amp;
    }
    h.pulse = (Math.sin(frame * 0.05 + h.phase) + 1) * 0.5;
  });
}

function updateObs() {
  obs.forEach(o => {
    o.phase += 0.03;
    if (o.type === 'blade') o.rot += o.rs;
    if (o.type === 'laser') {
      o.timer++;
      if (o.timer >= o.period) { o.on = !o.on; o.timer = 0; }
    }
    /* 무적 중 피해 무시: 쉴드, 피격 무적, 부활 무적 모두 포함 */
    if (P.shield || damCD > 0 || invincibleT > 0) return;
    let hit = false;
    const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy);
    if (o.type === 'spike' && d < 24) hit = true;
    if (o.type === 'blade' && d < 28) hit = true;
    if (o.type === 'laser' && o.on) {
      if (Math.abs(dy) < 13 && P.x > o.x - o.w/2 && P.x < o.x + o.w/2) hit = true;
    }
    if (hit) die(false);
  });
}

function updateCoins() {
  coins.forEach(c => {
    if (c.done) return;
    if (Math.hypot(P.x - c.x, P.y - c.y) < PLAYER_R + c.r) {
      c.done = true; score += 5;
      burst(c.x, c.y, '#ffd700', 6);
      floatText('+5', c.x, c.y - 10, '#ffd700');
    }
  });
}

/* ═══════════════════════════════════════════════════
   사망 처리
   ★ 수정:
     1. 낙사 시 부활 위치: 죽은 x 위치보다 오른쪽(+120px)에 배치해
        장애물 없는 안전한 지점에서 부활하도록 개선.
     2. 부활 시 2초(INVINCIBLE_FRAMES) 무적 부여.
     3. 부활 무적 중에는 장애물 피해를 입지 않음.
═══════════════════════════════════════════════════ */
function die(isFall) {
  /* 부활 무적 중에는 낙사 외 피해 무시 */
  if (invincibleT > 0 && !isFall) return;
  if (damCD > 0 && !isFall) return;

  hp--;
  updateHPUI(true);
  burst(P.x, P.y, '#ff4444', 22);

  if (hp <= 0) {
    gState = 'over';
    showOverlay('over');
    return;
  }

  damCD = 90;

  /* 부활 위치 결정 */
  if (isFall) {
    /* 마지막으로 잡았던 공점(lastHookX) 이후의 가장 가까운 공점을 찾아 부활
       - 공점이 없으면 lastHookX + 200 위치로 fallback */
    let spawnH = null;
    let spawnD = Infinity;
    hooks.forEach(h => {
      if (!h.alive) return;
      if (h.x <= lastHookX) return;     // 이미 지난 공점 무시
      const d = h.x - lastHookX;
      if (d < spawnD) { spawnD = d; spawnH = h; }
    });

    if (spawnH) {
      P.x = spawnH.x;
      P.y = spawnH.y - 80;             // 공점 바로 위에서 낙하 시작
    } else {
      P.x = lastHookX + 200;
      P.y = cam.y + H * 0.32;
    }
    P.vy = 0; P.vx = Math.max(P.vx * 0.5, 4);
    P.mode = 'fly'; P.hkRef = null;
  }

  /* 부활 무적 2초 부여 */
  invincibleT = INVINCIBLE_FRAMES;

  floatText('OUCH!', P.x, P.y - 44, '#ff5555');
  floatText('무적!', P.x, P.y - 66, '#ffc93c');
}

function addCombo() {
  combo++; comboT = 200;
  if (combo >= 3) floatText(`${combo}x COMBO!`, P.x, P.y - 72, '#ffc93c');
}

/* ═══════════════════════════════════════════════════
   카메라
═══════════════════════════════════════════════════ */
function updateCam() {
  const tx = P.x - W * 0.28;
  const ty = P.y - H * 0.44;
  cam.x += (tx - cam.x) * 0.09;
  cam.y += (ty - cam.y) * 0.08;

  if (cam.x + W * 1.8 > lastChunkX) spawnChunk(lastChunkX);

  const cullX = cam.x - 260;
  hooks  = hooks.filter(h => h.x > cullX);
  obs    = obs.filter(o => o.x > cullX);
  coins  = coins.filter(c => c.x > cullX);

  if (damCD > 0) damCD--;
  if (invincibleT > 0) invincibleT--;
  if (comboT > 0) { comboT--; if (!comboT) combo = 0; }
}

/* ═══════════════════════════════════════════════════
   파티클 & 플로팅 텍스트
═══════════════════════════════════════════════════ */
function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
    parts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 1.5,
                 life: 35 + Math.random()*20, col, r: 2 + Math.random()*2.5 });
  }
}

function floatText(txt, x, y, col) {
  floatTxts.push({ txt, x, y, col, life: 78, vy: -0.85 });
}

/* ═══════════════════════════════════════════════════
   메인 루프
═══════════════════════════════════════════════════ */
function loop() {
  requestAnimationFrame(loop);
  if (gState !== 'playing') return;
  frame++;
  updateHooks();
  updatePlayer();
  updateObs();
  updateCoins();
  updateCam();
  draw();
}

/* ═══════════════════════════════════════════════════
   HP UI
═══════════════════════════════════════════════════ */
function updateHPUI(shake) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('h' + i);
    el.classList.toggle('lost', i > hp);
    if (shake && i === hp + 1) {
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 200);
    }
  }
}

/* ═══════════════════════════════════════════════════
   오버레이 제어
═══════════════════════════════════════════════════ */
function showOverlay(which) {
  ['scrStart','scrPause','scrOver'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  document.getElementById('pauseBtn').style.display = 'none';

  if (which === 'start') {
    document.getElementById('scrStart').classList.remove('hidden');
  } else if (which === 'pause') {
    document.getElementById('scrPause').classList.remove('hidden');
  } else if (which === 'over') {
    document.getElementById('ovScore').textContent = score + 'm';
    document.getElementById('ovBest').textContent  = best  + 'm';
    localStorage.setItem('nhBest', best);
    document.getElementById('scrOver').classList.remove('hidden');
  } else { // 'none' = 게임 중
    document.getElementById('pauseBtn').style.display = '';
  }
}

/* ═══════════════════════════════════════════════════
   게임 흐름
═══════════════════════════════════════════════════ */
function startGame() { showOverlay('none'); gState = 'playing'; init(); }
function pauseGame()  { if (gState !== 'playing') return; gState = 'paused'; showOverlay('pause'); }
function resumeGame() { if (gState !== 'paused') return; gState = 'playing'; showOverlay('none'); }
function goMenu()     { gState = 'start'; showOverlay('start'); }

/* ═══════════════════════════════════════════════════
   이벤트 연결
═══════════════════════════════════════════════════ */
document.getElementById('btnStart').onclick     = startGame;
document.getElementById('btnResume').onclick    = resumeGame;
document.getElementById('btnPauseMenu').onclick = goMenu;
document.getElementById('btnRetry').onclick     = startGame;
document.getElementById('btnOverMenu').onclick  = goMenu;
document.getElementById('pauseBtn').onclick     = pauseGame;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if      (gState === 'playing') pauseGame();
    else if (gState === 'paused')  resumeGame();
  }
  if ((e.key === ' ' || e.key === 'Enter') && gState === 'paused') {
    e.preventDefault(); resumeGame();
  }
});

cv.addEventListener('mousedown',   onDown);
cv.addEventListener('mouseup',     onUp);
cv.addEventListener('mouseleave',  onUp);
cv.addEventListener('touchstart',  onDown, { passive: false });
cv.addEventListener('touchend',    onUp,   { passive: false });
cv.addEventListener('touchcancel', onUp,   { passive: false });

/* ─── 시작 ─── */
document.getElementById('bestTxt').textContent = best + 'm';
loop();
