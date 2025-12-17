(() => {
  /* =========================
     DOM
  ========================= */
  const scenes = {
    loading: document.getElementById('scene-loading'),
    wall: document.getElementById('scene-wall'),
    logs: document.getElementById('scene-logs'),
    report: document.getElementById('scene-report'),
  };

  const btnStart = document.getElementById('btn-start');
  const btnCalibStart = document.getElementById('btn-calib-start');
  const btnToLogs = document.getElementById('btn-to-logs');
  const btnToReport = document.getElementById('btn-to-report');
  const btnRestart = document.getElementById('btn-restart');

  const wallGrid = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreVoyeur = document.getElementById('score-voyeur');

  const logLines = document.getElementById('log-lines');
  const reportTextEl = document.getElementById('report-text');

  const calibrationOverlay = document.getElementById('calibration-overlay');

  const gazeDot = document.getElementById('gaze-dot');
  const gazeDotLogs = document.getElementById('gaze-dot-logs');

  /* =========================
     CONFIG
     A) Smoothing + blink filter
     B) Region snap
     C) Second-stage easing for the dot
  ========================= */
  const CFG = {
    tickMs: 50,

    // A) Smoothing (EMA)
    smoothAlpha: 0.35,

    // A) Blink / outlier filter
    maxJumpPx: 220,          // ignore huge jump
    dropHoldMs: 180,         // hold last stable point briefly

    // B) Region Snap
    snapRadiusPx: 95,        // when near a window center
    snapStrength: 0.65,      // how strongly to pull toward center

    // C) Dot easing
    dotEasing: 0.22,         // inertia for visual dot

    // Reaction thresholds
    tLv1: 0.9,               // red highlight
    tLv2: 1.4,               // write log
    tGhost: 2.2,             // ghost flash

    // Scoring (per second of sustained gaze)
    scorePerSecondBase: 1.0,
    scoreGhostBonus: 6,
    typeWeight: {
      PRIVATE_SUITE: 2.0,
      SERVICE_CORRIDOR: 1.2,
      STAIRWELL_C2: 1.15,
      REAR_ENTRANCE: 1.4,
      PARKING_LOT_A: 1.5,
      OFFICE_DESK_03: 1.25,
    },

    // Stability rating
    stabilityWindow: 30,     // samples
    stabilityMaxJitter: 22,  // px (lower is better)
  };

  /* =========================
     STATE
  ========================= */
  const state = {
    currentScene: 'loading',

    gazeEnabled: false,

    // Raw from webgazer
    raw: { x: 0, y: 0, t: 0, valid: false },

    // A) Smoothed gaze
    smooth: { x: 0, y: 0, t: 0, valid: false },
    lastStable: { x: 0, y: 0, t: 0, valid: false },

    // B) Snapped gaze (used for logic)
    snapped: { x: 0, y: 0 },

    // C) Dot position (visual only)
    dot: { x: 0, y: 0 },

    // CCTV windows
    wallWindows: [],

    // Fixation tracking (window-level)
    currentTarget: null,
    fixationS: 0,

    // Reaction flags to avoid spamming
    lv2LoggedForTarget: false,
    ghostTriggeredForTarget: false,

    // Intelligence layer
    voyeurScore: 0,
    fixationTotals: {}, // type -> seconds
    stabilitySamples: [], // recent smoothed deltas / jitter

    // Log
    logCount: 0,
  };

  /* =========================
     UTIL
  ========================= */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) {
    const dx = ax - bx; const dy = ay - by; return Math.sqrt(dx*dx + dy*dy);
  }

  function nowMs() { return Date.now(); }

  function addLog(text, sensitive = false) {
    if (!logLines) return;
    const line = document.createElement('div');
    line.className = 'log-line' + (sensitive ? ' sensitive' : '');
    const ts = new Date().toLocaleTimeString();
    line.textContent = `[${ts}] ${text}`;
    logLines.appendChild(line);
    logLines.scrollTop = logLines.scrollHeight;
    state.logCount++;
  }

  function setClasses(el, on, className) {
    el.classList.toggle(className, !!on);
  }

  function clearReactionClasses(el) {
    el.classList.remove('gaze-focus', 'gaze-lv1', 'gaze-lv2', 'gaze-lv3', 'gaze-ghost');
  }

  /* =========================
     SCENES
  ========================= */
  function switchScene(name) {
    state.currentScene = name;
    Object.entries(scenes).forEach(([k, el]) => el?.classList.toggle('active', k === name));

    gazeDot.style.display = name === 'wall' ? 'block' : 'none';
    gazeDotLogs.style.display = name === 'logs' ? 'block' : 'none';
  }

  /* =========================
     WALL: 6 CAMS
  ========================= */
  function createWall() {
    wallGrid.innerHTML = '';
    state.wallWindows = [];
    state.fixationTotals = {};

    const CAMS = [
      { id: 'CAM_01', type: 'PRIVATE_SUITE',    label: 'PRIVATE_SUITE / CAM_01' },
      { id: 'CAM_02', type: 'SERVICE_CORRIDOR', label: 'SERVICE_CORRIDOR / CAM_02' },
      { id: 'CAM_03', type: 'STAIRWELL_C2',     label: 'STAIRWELL_C2 / CAM_03' },
      { id: 'CAM_04', type: 'REAR_ENTRANCE',    label: 'REAR_ENTRANCE / CAM_04' },
      { id: 'CAM_05', type: 'PARKING_LOT_A',    label: 'PARKING_LOT_A / CAM_05' },
      { id: 'CAM_06', type: 'OFFICE_DESK_03',   label: 'OFFICE_DESK_03 / CAM_06' },
    ];

    CAMS.forEach((cam) => {
      const el = document.createElement('div');
      el.className = 'cam-window';
      el.dataset.cam = cam.id;
      el.dataset.type = cam.type;

      el.innerHTML = `
        <div class="cam-window-inner"></div>
        <div class="cam-label">${cam.label}</div>
        <div class="cam-rec">REC</div>
        <div class="cam-overlay"></div>
      `;

      wallGrid.appendChild(el);

      state.wallWindows.push({
        el,
        camId: cam.id,
        type: cam.type,
      });

      state.fixationTotals[cam.type] = 0;
    });
  }

  /* =========================
     SCORE + PROFILE + STABILITY
  ========================= */
  function updateScoreUI() {
    if (scoreVoyeur) scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
  }

  function computeProfile() {
    // Determine dominant type by fixation totals
    const entries = Object.entries(state.fixationTotals);
    if (!entries.length) return 'Balanced Observer';

    entries.sort((a, b) => b[1] - a[1]);
    const [topType, topSec] = entries[0];
    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;
    const ratio = topSec / total;

    if (ratio < 0.34) return 'Balanced Observer';

    if (topType === 'PRIVATE_SUITE') return 'Bedroom Watcher';
    if (topType === 'SERVICE_CORRIDOR') return 'Corridor Scanner';
    if (topType === 'PARKING_LOT_A') return 'Danger Seeker';
    if (topType === 'REAR_ENTRANCE') return 'Backdoor Listener';
    if (topType === 'STAIRWELL_C2') return 'Escape Route Observer';
    if (topType === 'OFFICE_DESK_03') return 'Desk Lurker';

    return 'Balanced Observer';
  }

  function computeStabilityStars() {
    // Use recent jitter of smoothed gaze
    const n = state.stabilitySamples.length;
    if (n < 8) return 3;

    const avg = state.stabilitySamples.reduce((s, v) => s + v, 0) / n;
    // Map avg jitter (px) -> 1..5 stars (lower jitter => more stars)
    const normalized = clamp(1 - avg / CFG.stabilityMaxJitter, 0, 1);
    const stars = Math.round(1 + normalized * 4);
    return clamp(stars, 1, 5);
  }

  function starsText(n) {
    const full = '★★★★★'.slice(0, n);
    const empty = '☆☆☆☆☆'.slice(0, 5 - n);
    return full + empty;
  }

  /* =========================
     A) SMOOTHING + BLINK FILTER
  ========================= */
  function processRawToSmoothed() {
    if (!state.raw.valid) return;

    const t = state.raw.t;
    const rx = state.raw.x;
    const ry = state.raw.y;

    // If first valid, initialize
    if (!state.smooth.valid) {
      state.smooth = { x: rx, y: ry, t, valid: true };
      state.lastStable = { x: rx, y: ry, t, valid: true };
      return;
    }

    const jump = dist(rx, ry, state.smooth.x, state.smooth.y);

    // Blink/outlier filter: ignore huge jump, hold last stable
    if (jump > CFG.maxJumpPx) {
      const dt = t - state.lastStable.t;
      if (dt < CFG.dropHoldMs) {
        // hold last stable for a short time
        state.smooth.x = state.lastStable.x;
        state.smooth.y = state.lastStable.y;
        state.smooth.t = t;
        return;
      }
      // after holding, accept but softly
    }

    // EMA smoothing
    const ax = CFG.smoothAlpha;
    const sx = lerp(state.smooth.x, rx, ax);
    const sy = lerp(state.smooth.y, ry, ax);

    // Track jitter for stability
    const jitter = dist(sx, sy, state.smooth.x, state.smooth.y);
    state.stabilitySamples.push(jitter);
    if (state.stabilitySamples.length > CFG.stabilityWindow) state.stabilitySamples.shift();

    state.smooth.x = sx;
    state.smooth.y = sy;
    state.smooth.t = t;

    // Update last stable
    state.lastStable = { x: sx, y: sy, t, valid: true };
  }

  /* =========================
     B) REGION SNAP
     If gaze is near a window center, snap it toward center.
========================= */
  function applyRegionSnap() {
    const gx = state.smooth.x;
    const gy = state.smooth.y;

    let best = null;
    let bestD = Infinity;
    let bestCenter = null;

    for (const w of state.wallWindows) {
      const r = w.el.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const d = dist(gx, gy, cx, cy);
      if (d < bestD) {
        bestD = d;
        best = w;
        bestCenter = { x: cx, y: cy };
      }
    }

    if (best && bestD <= CFG.snapRadiusPx) {
      const k = CFG.snapStrength * (1 - bestD / CFG.snapRadiusPx);
      state.snapped.x = lerp(gx, bestCenter.x, k);
      state.snapped.y = lerp(gy, bestCenter.y, k);
    } else {
      state.snapped.x = gx;
      state.snapped.y = gy;
    }
  }

  /* =========================
     C) DOT EASING
========================= */
  function updateDot() {
    const tx = (state.currentScene === 'wall') ? state.snapped.x : state.smooth.x;
    const ty = (state.currentScene === 'wall') ? state.snapped.y : state.smooth.y;

    state.dot.x = lerp(state.dot.x || tx, tx, CFG.dotEasing);
    state.dot.y = lerp(state.dot.y || ty, ty, CFG.dotEasing);

    if (state.currentScene === 'wall') {
      gazeDot.style.left = state.dot.x + 'px';
      gazeDot.style.top = state.dot.y + 'px';
    } else if (state.currentScene === 'logs') {
      gazeDotLogs.style.left = state.dot.x + 'px';
      gazeDotLogs.style.top = state.dot.y + 'px';
    }
  }

  /* =========================
     WINDOW HIT TEST (logic uses snapped gaze)
========================= */
  function getHitWindow(x, y) {
    for (const w of state.wallWindows) {
      const r = w.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return w;
    }
    return null;
  }

  /* =========================
     5) INTERACTIVE REACTION LAYER
     >0.9s  : highlight (lv1)
     >1.4s  : write log (lv2)
     >2.2s  : ghost reflection (ghost)
========================= */
  function updateReactions(dtSeconds) {
    // Clear classes first (for adaptive behavior)
    for (const w of state.wallWindows) clearReactionClasses(w.el);

    const hit = getHitWindow(state.snapped.x, state.snapped.y);

    if (!hit) {
      state.currentTarget = null;
      state.fixationS = 0;
      state.lv2LoggedForTarget = false;
      state.ghostTriggeredForTarget = false;
      labelViewer.textContent = 'No target locked.';
      return;
    }

    // Focus
    hit.el.classList.add('gaze-focus');

    // If target changed, reset timers and flags
    if (hit !== state.currentTarget) {
      state.currentTarget = hit;
      state.fixationS = 0;
      state.lv2LoggedForTarget = false;
      state.ghostTriggeredForTarget = false;
    }

    state.fixationS += dtSeconds;

    // Always accumulate fixation totals
    state.fixationTotals[hit.type] = (state.fixationTotals[hit.type] || 0) + dtSeconds;

    // Score accumulates only when actively fixating a target
    const weight = CFG.typeWeight[hit.type] || 1.0;
    state.voyeurScore += CFG.scorePerSecondBase * weight * dtSeconds;
    updateScoreUI();

    // Update UI label
    labelViewer.textContent = `Locked: ${hit.type} (${hit.camId}) — Fixation: ${state.fixationS.toFixed(2)}s`;

    // Level 1/2/3 visual classes
    if (state.fixationS >= CFG.tLv1) hit.el.classList.add('gaze-lv1');
    if (state.fixationS >= CFG.tLv2) hit.el.classList.add('gaze-lv2');
    if (state.fixationS >= CFG.tLv2 + 0.2) hit.el.classList.add('gaze-lv3'); // keeps a small staging

    // Level 2 log once per target fixation session
    if (state.fixationS >= CFG.tLv2 && !state.lv2LoggedForTarget) {
      state.lv2LoggedForTarget = true;
      addLog(`Fixation threshold reached on ${hit.type} (${hit.camId}).`, true);
    }

    // Ghost flash at 2.2s once per target session
    if (state.fixationS >= CFG.tGhost && !state.ghostTriggeredForTarget) {
      state.ghostTriggeredForTarget = true;
      hit.el.classList.add('gaze-ghost');
      state.voyeurScore += CFG.scoreGhostBonus;
      updateScoreUI();
      addLog(`Ghost Reflection triggered on ${hit.type} (${hit.camId}).`, true);
    }
  }

  /* =========================
     LOG CONSOLE + REPORT
========================= */
  function generateReport() {
    const profile = computeProfile();
    const stars = computeStabilityStars();
    const stability = starsText(stars);

    const entries = Object.entries(state.fixationTotals)
      .sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;

    const listHtml = entries.map(([type, sec]) => {
      const pct = (sec / total) * 100;
      return `<li><b>${type}</b>: ${sec.toFixed(1)}s (${pct.toFixed(1)}%)</li>`;
    }).join('');

    reportTextEl.innerHTML = `
      <p>
        The system analyzed your gaze behavior across six surveillance channels.
        This report is generated from fixation duration, snap-locked targets, and ghost reflection events.
      </p>
      <p>
        <b>Voyeur Score:</b> ${state.voyeurScore.toFixed(0)}<br/>
        <b>Profile Estimation:</b> ${profile}<br/>
        <b>Eye Stability:</b> ${stability}
      </p>
      <p><b>Fixation Distribution</b></p>
      <ul>${listHtml}</ul>
      <p>
        Interpretation: The longer you stare, the more the system "recognizes intent".
        Accidental glances are filtered by smoothing + snap logic. Ghost reflections occur only after sustained fixation.
      </p>
    `;
  }

  /* =========================
     WEBGAZER
========================= */
  function initGaze() {
    if (!window.webgazer) {
      addLog('WebGazer not available. Eye tracking disabled.', true);
      return;
    }

    addLog('Eye tracking initializing...', false);

    webgazer
      .setRegression('ridge')
      .setGazeListener((data, timestamp) => {
        if (!data) return;
        state.raw.x = data.x;
        state.raw.y = data.y;
        state.raw.t = timestamp || nowMs();
        state.raw.valid = true;
      })
      .begin()
      .then(() => {
        webgazer.showVideo(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        state.gazeEnabled = true;

        addLog('Eye tracking online.', false);
      })
      .catch((err) => {
        addLog('Eye tracking failed to start.', true);
        console.error(err);
      });
  }

  /* =========================
     MAIN LOOP
========================= */
  function tick() {
    const dt = CFG.tickMs / 1000;

    if (state.gazeEnabled && state.raw.valid) {
      // A) smoothing + blink filter
      processRawToSmoothed();

      // B) region snap only on wall scene (still safe if called elsewhere)
      if (state.currentScene === 'wall') applyRegionSnap();
      else {
        state.snapped.x = state.smooth.x;
        state.snapped.y = state.smooth.y;
      }

      // C) dot easing
      updateDot();

      // Reaction layer
      if (state.currentScene === 'wall') updateReactions(dt);
    }

    requestAnimationFrame(tick);
  }

  /* =========================
     BUTTONS
========================= */
  btnStart.onclick = () => {
    calibrationOverlay.classList.remove('hidden');
  };

  btnCalibStart.onclick = () => {
    calibrationOverlay.classList.add('hidden');
    initGaze();
    switchScene('wall');
    addLog('Entered CCTV GRID.', false);
  };

  btnToLogs.onclick = () => {
    switchScene('logs');
    addLog('Entered LOG CONSOLE.', false);
  };

  btnToReport.onclick = () => {
    generateReport();
    switchScene('report');
    addLog('Generated final report.', false);
  };

  btnRestart.onclick = () => location.reload();

  /* =========================
     INIT
========================= */
  function init() {
    switchScene('loading');
    createWall();
    updateScoreUI();

    // Seed logs with a few lines
    addLog('WINDOW daemon started.', false);
    addLog('Six remote channels connected.', false);
    addLog('Awaiting calibration...', false);

    tick();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
