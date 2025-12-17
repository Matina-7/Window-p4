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
     CONFIG (tune here)
  ========================= */
  const CFG = {
    tickMs: 50,

    // A) Smoothing (EMA)
    smoothAlpha: 0.35,

    // Blink / outlier filter
    maxJumpPx: 240,
    holdMsAfterDrop: 180,

    // B) Region snap
    snapRadiusPx: 105,
    snapStrength: 0.7,

    // C) Dot easing
    dotEasing: 0.22,

    // Reaction thresholds
    tLv1: 0.9,
    tLv2: 1.4,
    tLv3: 1.8,
    tGhost: 2.2,

    // Scoring
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
    stabilityWindow: 30,
    stabilityMaxJitter: 22,

    // Ghost reflection
    ghostOpacityHint: 0.22, // used in blending feel (CSS handles mix-blend-mode)
  };

  /* =========================
     STATE
  ========================= */
  const state = {
    currentScene: 'loading',

    // webgazer
    gazeEnabled: false,
    raw: { x: 0, y: 0, t: 0, valid: false },
    smooth: { x: 0, y: 0, t: 0, valid: false },
    lastStable: { x: 0, y: 0, t: 0, valid: false },

    // snapped + dot
    snapped: { x: 0, y: 0 },
    dot: { x: 0, y: 0 },

    // windows
    wallWindows: [],

    // fixation
    currentTarget: null,
    fixationS: 0,
    lv2Logged: false,
    ghostTriggered: false,

    // intelligence
    voyeurScore: 0,
    fixationTotals: {}, // type -> seconds
    stabilitySamples: [],

    // camera stream for ghost reflection
    camStream: null,
    camVideo: null,
    camCanvas: null,
    camCtx: null,
    camReady: false,
  };

  /* =========================
     UTIL
  ========================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function nowMs() { return Date.now(); }

  function addLog(text, sensitive = false) {
    if (!logLines) return;
    const line = document.createElement('div');
    line.className = 'log-line' + (sensitive ? ' sensitive' : '');
    const ts = new Date().toLocaleTimeString();
    line.textContent = `[${ts}] ${text}`;
    logLines.appendChild(line);
    logLines.scrollTop = logLines.scrollHeight;
  }

  function updateScoreUI() {
    if (scoreVoyeur) scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
  }

  function starsText(n) {
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function computeStabilityStars() {
    const n = state.stabilitySamples.length;
    if (n < 8) return 3;
    const avg = state.stabilitySamples.reduce((s, v) => s + v, 0) / n;
    const normalized = clamp(1 - avg / CFG.stabilityMaxJitter, 0, 1);
    return clamp(Math.round(1 + normalized * 4), 1, 5);
  }

  function computeProfile() {
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

  function clearClasses(el) {
    el.classList.remove(
      'gaze-enter',
      'gaze-focus',
      'gaze-lv1',
      'gaze-lv2',
      'gaze-lv3',
      'gaze-ghost'
    );
    const overlay = el.querySelector('.cam-overlay');
    if (overlay) overlay.style.backgroundImage = '';
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
     CAMERA STREAM for Ghost Reflection
  ========================= */
  async function initCameraStream() {
    try {
      // Create hidden video/canvas for snapshots
      const video = document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      video.autoplay = true;
      video.style.position = 'fixed';
      video.style.left = '-9999px';
      video.style.top = '-9999px';

      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.left = '-9999px';
      canvas.style.top = '-9999px';

      document.body.appendChild(video);
      document.body.appendChild(canvas);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;

      await new Promise((res) => {
        video.onloadedmetadata = () => res();
      });

      canvas.width = Math.max(320, video.videoWidth || 640);
      canvas.height = Math.max(240, video.videoHeight || 480);

      state.camStream = stream;
      state.camVideo = video;
      state.camCanvas = canvas;
      state.camCtx = canvas.getContext('2d');
      state.camReady = true;

      addLog('Camera stream ready for ghost reflections.', false);
    } catch (e) {
      state.camReady = false;
      addLog('Camera permission denied. Ghost reflections will fallback to flash.', true);
    }
  }

  function captureGhostDataURL() {
    if (!state.camReady || !state.camCtx || !state.camVideo) return null;
    try {
      // Mirror for "reflection" feel
      const ctx = state.camCtx;
      const c = state.camCanvas;
      ctx.save();
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
      ctx.globalAlpha = 1.0;
      ctx.drawImage(state.camVideo, 0, 0, c.width, c.height);
      ctx.restore();

      // Add subtle dark vignette
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();

      return c.toDataURL('image/jpeg', 0.65);
    } catch {
      return null;
    }
  }

  /* =========================
     A) Smoothing + Outlier Filter
  ========================= */
  function updateSmoothed() {
    if (!state.raw.valid) return;

    const rx = state.raw.x;
    const ry = state.raw.y;
    const t = state.raw.t || nowMs();

    if (!state.smooth.valid) {
      state.smooth = { x: rx, y: ry, t, valid: true };
      state.lastStable = { x: rx, y: ry, t, valid: true };
      return;
    }

    const jump = dist(rx, ry, state.smooth.x, state.smooth.y);

    if (jump > CFG.maxJumpPx) {
      const dt = t - (state.lastStable.t || t);
      if (dt < CFG.holdMsAfterDrop) {
        // hold last stable point briefly (blink/outlier)
        state.smooth.x = state.lastStable.x;
        state.smooth.y = state.lastStable.y;
        state.smooth.t = t;
        return;
      }
      // accept but still smooth after hold window
    }

    const ax = CFG.smoothAlpha;
    const nx = lerp(state.smooth.x, rx, ax);
    const ny = lerp(state.smooth.y, ry, ax);

    // stability jitter sample
    const jitter = dist(nx, ny, state.smooth.x, state.smooth.y);
    state.stabilitySamples.push(jitter);
    if (state.stabilitySamples.length > CFG.stabilityWindow) state.stabilitySamples.shift();

    state.smooth.x = nx;
    state.smooth.y = ny;
    state.smooth.t = t;

    state.lastStable = { x: nx, y: ny, t, valid: true };
  }

  /* =========================
     B) Region Snap
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
     C) Dot Easing (visual only)
  ========================= */
  function updateDot() {
    const targetX = (state.currentScene === 'wall') ? state.snapped.x : state.smooth.x;
    const targetY = (state.currentScene === 'wall') ? state.snapped.y : state.smooth.y;

    state.dot.x = lerp(state.dot.x || targetX, targetX, CFG.dotEasing);
    state.dot.y = lerp(state.dot.y || targetY, targetY, CFG.dotEasing);

    if (state.currentScene === 'wall') {
      gazeDot.style.left = state.dot.x + 'px';
      gazeDot.style.top = state.dot.y + 'px';
    } else if (state.currentScene === 'logs') {
      gazeDotLogs.style.left = state.dot.x + 'px';
      gazeDotLogs.style.top = state.dot.y + 'px';
    }
  }

  /* =========================
     HIT TEST
  ========================= */
  function hitWindowByPoint(x, y) {
    for (const w of state.wallWindows) {
      const r = w.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return w;
    }
    return null;
  }

  /* =========================
     REACTION LAYER
     - Immediate: red frame on enter (gaze-enter)
     - Progressive: lv1/lv2/lv3
     - Ghost: webcam reflection overlay flash
  ========================= */
  function updateReactions(dt) {
    // Clear all classes
    for (const w of state.wallWindows) clearClasses(w.el);

    const hit = hitWindowByPoint(state.snapped.x, state.snapped.y);

    // Immediate red frame on hover (enter)
    if (hit) hit.el.classList.add('gaze-enter');

    if (!hit) {
      state.currentTarget = null;
      state.fixationS = 0;
      state.lv2Logged = false;
      state.ghostTriggered = false;
      labelViewer.textContent = 'No target locked.';
      return;
    }

    // If target changed, reset fixation and one-time flags
    if (hit !== state.currentTarget) {
      state.currentTarget = hit;
      state.fixationS = 0;
      state.lv2Logged = false;
      state.ghostTriggered = false;
    }

    // Accumulate fixation
    state.fixationS += dt;

    // Update focus UI
    hit.el.classList.add('gaze-focus');
    labelViewer.textContent = `Locked: ${hit.type} (${hit.camId}) — Fixation: ${state.fixationS.toFixed(2)}s`;

    // Intelligence: accumulate fixation totals
    state.fixationTotals[hit.type] = (state.fixationTotals[hit.type] || 0) + dt;

    // Scoring: accumulate per second while in a window
    const weight = CFG.typeWeight[hit.type] || 1.0;
    state.voyeurScore += CFG.scorePerSecondBase * weight * dt;
    updateScoreUI();

    // Progressive visual levels
    if (state.fixationS >= CFG.tLv1) hit.el.classList.add('gaze-lv1');
    if (state.fixationS >= CFG.tLv2) hit.el.classList.add('gaze-lv2');
    if (state.fixationS >= CFG.tLv3) hit.el.classList.add('gaze-lv3');

    // LV2 log once per target session
    if (state.fixationS >= CFG.tLv2 && !state.lv2Logged) {
      state.lv2Logged = true;
      addLog(`Fixation threshold reached on ${hit.type} (${hit.camId}).`, true);
    }

    // Ghost reflection once per target session
    if (state.fixationS >= CFG.tGhost && !state.ghostTriggered) {
      state.ghostTriggered = true;
      state.voyeurScore += CFG.scoreGhostBonus;
      updateScoreUI();

      const overlay = hit.el.querySelector('.cam-overlay');
      const dataUrl = captureGhostDataURL();

      // If we have camera, use real ghost reflection; else fallback flash
      if (overlay) {
        if (dataUrl) {
          overlay.style.backgroundImage = `url("${dataUrl}")`;
        } else {
          overlay.style.backgroundImage = '';
        }
      }

      hit.el.classList.add('gaze-ghost');
      addLog(`Ghost reflection triggered on ${hit.type} (${hit.camId}).`, true);
    }
  }

  /* =========================
     REPORT
  ========================= */
  function generateReport() {
    const profile = computeProfile();
    const stars = computeStabilityStars();
    const stability = starsText(stars);

    const entries = Object.entries(state.fixationTotals)
      .sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((s, [,v]) => s + v, 0) || 1;

    const list = entries.map(([type, sec]) => {
      const pct = (sec / total) * 100;
      return `<li><b>${type}</b>: ${sec.toFixed(1)}s (${pct.toFixed(1)}%)</li>`;
    }).join('');

    reportTextEl.innerHTML = `
      <p>
        The system analyzed your gaze behavior across six surveillance channels.
        Accidental glances are stabilized via smoothing and region snap. Sustained fixation is treated as intent.
      </p>
      <p>
        <b>Voyeur Score:</b> ${state.voyeurScore.toFixed(0)}<br/>
        <b>Profile Estimation:</b> ${profile}<br/>
        <b>Eye Stability:</b> ${stability}
      </p>
      <p><b>Fixation Distribution</b></p>
      <ul>${list}</ul>
      <p>
        Interpretation: the longer you stare, the more the system reacts. Ghost reflections appear only after prolonged fixation.
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
      .catch(() => {
        addLog('Eye tracking failed to start.', true);
      });
  }

  /* =========================
     MAIN LOOP
  ========================= */
  function tick() {
    const dt = CFG.tickMs / 1000;

    if (state.gazeEnabled && state.raw.valid) {
      updateSmoothed();

      if (state.currentScene === 'wall') {
        applyRegionSnap();
      } else {
        state.snapped.x = state.smooth.x;
        state.snapped.y = state.smooth.y;
      }

      updateDot();

      if (state.currentScene === 'wall') {
        updateReactions(dt);
      }
    }

    setTimeout(tick, CFG.tickMs);
  }

  /* =========================
     BUTTONS
  ========================= */
  btnStart.onclick = () => {
    calibrationOverlay.classList.remove('hidden');
  };

  btnCalibStart.onclick = async () => {
    calibrationOverlay.classList.add('hidden');

    // Start camera stream early so ghost reflection can be real
    await initCameraStream();

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

    addLog('WINDOW daemon started.', false);
    addLog('Six remote channels connected.', false);
    addLog('Awaiting calibration...', false);

    tick();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
