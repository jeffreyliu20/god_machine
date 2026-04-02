'use strict';

// ── Sacred alphabet ───────────────────────────────────────────
// 24 Greek capital letters — recognisable as ancient/sacred script,
// renders reliably on every OS without any web font request.
const ALPHABET = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'.split('');
const BASE     = ALPHABET.length;  // 24

// ── Configuration ─────────────────────────────────────────────
const TOTAL      = 9_000_000_000;  // nine billion — the story's target
const BASE_BATCH = 300;            // names per tick at 1× speed
const INTERVAL   = 60;             // ms between ticks

// ── Speed state ───────────────────────────────────────────────
// Logarithmic scale: slider 0–100 → multiplier 1×–10,000×
// (four decades, evenly spaced at 0 / 25 / 50 / 75 / 100)
let speedMult = 1;

// ── Generator state ───────────────────────────────────────────
let position = [0];
let count    = 0;
let running  = false;
let finished = false;
let timerId  = null;

// ── Timer state ───────────────────────────────────────────────
// We accumulate elapsed ms so pausing doesn't reset the clock.
let timerAccum = 0;     // ms logged in previous runs
let timerStart = null;  // Date.now() when current run started, null when stopped

function getElapsedMs() {
  return timerStart === null ? timerAccum : timerAccum + (Date.now() - timerStart);
}

function formatTimer(ms) {
  const s   = Math.floor(ms / 1000);
  const sec = s % 60;
  const min = Math.floor(s / 60) % 60;
  const hr  = Math.floor(s / 3600) % 24;
  const day = Math.floor(s / 86400);
  const p   = n => String(n).padStart(2, '0');
  return `${day}d ${p(hr)}:${p(min)}:${p(sec)}`;
}

// ── DOM refs ──────────────────────────────────────────────────
const nameOutput    = document.getElementById('nameOutput');
const counterEl     = document.getElementById('counter');
const percentEl     = document.getElementById('percent');
const lengthEl      = document.getElementById('seqLength');
const timerEl       = document.getElementById('timer');
const btnStart      = document.getElementById('btnStart');
const btnPause      = document.getElementById('btnPause');
const btnReset      = document.getElementById('btnReset');
const speedSlider   = document.getElementById('speedSlider');
const speedDisplay  = document.getElementById('speedDisplay');

// ── Generator helpers ─────────────────────────────────────────

function currentName() {
  return position.map(i => ALPHABET[i]).join('');
}

// Increment `position` like a base-24 odometer.
// Promotes to the next length when all digits overflow.
// Returns false only when all length-1..9 names are exhausted.
function advance() {
  for (let i = position.length - 1; i >= 0; i--) {
    position[i]++;
    if (position[i] < BASE) return true;
    position[i] = 0;  // carry
  }
  if (position.length < 9) {
    position = new Array(position.length + 1).fill(0);
    return true;
  }
  return false;  // fully exhausted
}

// Reject names where any character appears four times running.
function hasQuadRun(pos) {
  for (let i = 0; i <= pos.length - 4; i++) {
    if (pos[i] === pos[i + 1] &&
        pos[i + 1] === pos[i + 2] &&
        pos[i + 2] === pos[i + 3]) return true;
  }
  return false;
}

// ── Display ───────────────────────────────────────────────────

function updateDisplay(name) {
  nameOutput.textContent = name;
  counterEl.textContent  = count.toLocaleString('en-US');
  percentEl.textContent  = (count / TOTAL * 100).toFixed(6) + '%';
  lengthEl.textContent   = name.length;
  timerEl.textContent    = formatTimer(getElapsedMs());
}

// ── Speed helpers ─────────────────────────────────────────────

function sliderToMult(v) {
  // v: 0–100  →  multiplier: 1–10,000 (log scale over 4 decades)
  return Math.round(Math.pow(10, v * 4 / 100));
}

function formatMult(m) {
  if (m >= 1000) return (m / 1000) + 'K×';
  return m + '×';
}

speedSlider.addEventListener('input', () => {
  speedMult = sliderToMult(parseInt(speedSlider.value));
  speedDisplay.textContent = formatMult(speedMult);
});

// ── Main tick ─────────────────────────────────────────────────

function tick() {
  const batchSize = BASE_BATCH * speedMult;
  let lastValid = null;

  for (let i = 0; i < batchSize; i++) {
    if (!hasQuadRun(position)) {
      lastValid = currentName();
      count++;
      if (count >= TOTAL) {
        updateDisplay(lastValid);
        complete();
        return;
      }
    }
    if (!advance()) {
      if (lastValid) updateDisplay(lastValid);
      complete();
      return;
    }
  }

  if (lastValid) updateDisplay(lastValid);
}

// ── Machine states ────────────────────────────────────────────

function startMachine() {
  if (finished) return;
  running    = true;
  timerStart = Date.now();
  btnStart.disabled = true;
  btnPause.disabled = false;
  timerId = setInterval(tick, INTERVAL);
}

function pauseMachine() {
  running    = false;
  timerAccum = getElapsedMs();
  timerStart = null;
  clearInterval(timerId);
  timerId = null;
  btnStart.disabled    = false;
  btnStart.textContent = 'RESUME';
  btnPause.disabled    = true;
}

function resetMachine() {
  clearInterval(timerId);
  timerId    = null;
  running    = false;
  finished   = false;
  timerAccum = 0;
  timerStart = null;
  position   = [0];
  count      = 0;

  nameOutput.innerHTML  = '<span class="cursor">▮</span>';
  counterEl.textContent = '0';
  percentEl.textContent = '0.000000%';
  lengthEl.textContent  = '—';
  timerEl.textContent   = '0d 00:00:00';

  btnStart.disabled    = false;
  btnStart.textContent = 'START';
  btnPause.disabled    = true;

  // Remove cutscene canvas if the user resets mid-ending
  const existing = document.getElementById('cutscene');
  if (existing) existing.remove();
  document.querySelector('.machine').style.cssText = '';
}

function complete() {
  clearInterval(timerId);
  timerId  = null;
  running  = false;
  finished = true;

  // Freeze the timer at its final value
  timerAccum = getElapsedMs();
  timerStart = null;

  counterEl.textContent = count.toLocaleString('en-US');
  percentEl.textContent = '100.000000%';
  timerEl.textContent   = formatTimer(timerAccum);

  btnStart.disabled = true;
  btnPause.disabled = true;

  // Brief pause to read the final name, then the epitaph, then the sky.
  setTimeout(() => {
    nameOutput.innerHTML = '<span class="done">— IT IS DONE —</span>';
  }, 800);

  setTimeout(launchCutscene, 5800);  // 800ms to show text + 5s to read it
}

// ── Star cutscene ─────────────────────────────────────────────
//
// Phase 1 — Pan (0 → PAN_DURATION ms):
//   Camera tilts upward; world-y coords shift down on screen,
//   revealing stars that were placed above the initial viewport.
//
// Phase 2 — Dim (DIM_DELAY ms onward):
//   Stars are assigned random death timestamps spread over
//   DIM_SPREAD ms.  Each fades individually over FADE_TIME ms.
//
// Phase 3 — Silence:
//   Once every star's alpha hits 0, the canvas is pure black.
//   The machine has completed its task.

function launchCutscene() {
  const canvas  = document.createElement('canvas');
  canvas.id     = 'cutscene';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const W   = canvas.width;
  const H   = canvas.height;
  const ctx = canvas.getContext('2d');

  // Stars span the viewport plus an equal amount of headroom above it,
  // so the pan reveals a fresh field of stars entering from the top.
  const HEADROOM    = H;
  const NUM_STARS   = 320;
  const PAN_DIST    = HEADROOM * 0.65;  // how far the camera drifts up
  const PAN_DUR     = 7000;             // ms to complete the pan
  const DIM_DELAY   = 4000;             // ms before any star dies
  const DIM_SPREAD  = 60000;            // ms spread between first and last death (one minute)
  const FADE_TIME   = 1400;             // ms each individual star takes to fade

  // Real night-sky colour distribution: mostly blue-white, a few warm
  const palette = ['#ffffff', '#ffffff', '#f0f4ff', '#fffef5', '#ffeedd'];

  const stars = [];
  for (let i = 0; i < NUM_STARS; i++) {
    const roll = Math.random();
    const r = roll < 0.60 ? Math.random() * 0.5 + 0.2   // tiny (60%)
             : roll < 0.88 ? Math.random() * 0.6 + 0.7  // small (28%)
             :               Math.random() * 0.9 + 1.3; // bright (12%)
    stars.push({
      x:          Math.random() * W,
      y:          Math.random() * (H + HEADROOM) - HEADROOM,
      r,
      color:      palette[Math.floor(Math.random() * palette.length)],
      baseBright: Math.random() * 0.35 + 0.65,
      twAmp:      Math.random() * 0.18,
      twFreq:     Math.random() * 2.5 + 0.8,
      alpha:      1,
      deathAt:    null,
    });
  }

  let startTs      = null;
  let dimScheduled = false;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - Math.min(t, 1), 3);
  }

  function render(ts) {
    if (!startTs) startTs = ts;
    const elapsed = ts - startTs;

    // Pan: stars drift downward as the camera tilts up
    const panOffset = easeOutCubic(elapsed / PAN_DUR) * PAN_DIST;

    // Schedule all star deaths once, at DIM_DELAY
    if (elapsed >= DIM_DELAY && !dimScheduled) {
      dimScheduled = true;
      const order = [...stars].sort(() => Math.random() - 0.5);
      order.forEach((s, i) => {
        s.deathAt = startTs + DIM_DELAY + (i / order.length) * DIM_SPREAD;
      });
    }

    // Clear to absolute black
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    let anyAlive = false;

    for (const s of stars) {
      // Update opacity once this star's death time has passed
      if (s.deathAt !== null) {
        const age = ts - s.deathAt;
        if (age > 0) s.alpha = Math.max(0, 1 - age / FADE_TIME);
      }
      if (s.alpha <= 0) continue;
      anyAlive = true;

      // Twinkle
      const tw = 1 + s.twAmp * Math.sin(elapsed * 0.001 * s.twFreq * Math.PI * 2);
      const a  = s.alpha * s.baseBright * tw;
      const sy = s.y + panOffset;  // screen-y after pan

      // Faint diffuse halo on larger stars
      if (s.r > 1.2) {
        ctx.globalAlpha = a * 0.12;
        ctx.fillStyle   = s.color;
        ctx.beginPath();
        ctx.arc(s.x, sy, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Star core
      ctx.globalAlpha = a;
      ctx.fillStyle   = s.color;
      ctx.beginPath();
      ctx.arc(s.x, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Keep animating until every last star is gone
    if (anyAlive || !dimScheduled) requestAnimationFrame(render);
    // else: pure black — silence
  }

  // Fade the machine panel out, then let the canvas fade in behind it
  const machine = document.querySelector('.machine');
  machine.style.transition = 'opacity 1.2s ease';
  machine.style.opacity    = '0';

  setTimeout(() => {
    canvas.style.transition = 'opacity 1.5s ease';
    canvas.style.opacity    = '1';
    requestAnimationFrame(render);
  }, 1000);
}

// ── Event listeners ───────────────────────────────────────────
btnStart.addEventListener('click', startMachine);
btnPause.addEventListener('click', pauseMachine);
btnReset.addEventListener('click', resetMachine);

// Hidden debug trigger: clicking "GOD" in the title fires the ending sequence.
// No visual indication — it just looks like title text.
document.getElementById('godTrigger').addEventListener('click', () => {
  if (!finished) complete();
});
