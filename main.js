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
  ========================= */
  const CFG = {
    tickMs: 50,
    smoothAlpha: 0.35,
    maxJumpPx: 220,
    dropHoldMs: 180,
    snapRadiusPx: 95,
    snapStrength: 0.65,
    dotEasing: 0.22,
    tLv1: 0.9,
    tLv2: 1.4,
    tGhost: 2.2,
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
  };

  /* =========================
     STATE
  ========================= */
  const state = {
    currentScene: 'loading',
    gazeEnabled: false,
    raw: { x: 0, y: 0, t: 0, valid: false },
    smooth: { x: 0, y: 0, t: 0, valid: false },
    snapped: { x: 0, y: 0 },
    dot: { x: 0, y: 0 },
    wallWindows: [],
    currentTarget: null,
    fixationS: 0,
    lv2Logged: false,
    ghostTriggered: false,
    voyeurScore: 0,
    fixationTotals: {},
  };

  /* =========================
     UTIL
  ========================= */
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function addLog(text, sensitive = false) {
    if (!logLines) return;
    const line = document.createElement('div');
    line.className = 'log-line' + (sensitive ? ' sensitive' : '');
    line.textContent = text;
    logLines.appendChild(line);
    logLines.scrollTop = logLines.scrollHeight;
  }

  /* =========================
     SCENE
  ========================= */
  function switchScene(name) {
    state.currentScene = name;
    Object.entries(scenes).forEach(([k, el]) =>
      el.classList.toggle('active', k === name)
    );
    gazeDot.style.display = name === 'wall' ? 'block' : 'none';
    gazeDotLogs.style.display = name === 'logs' ? 'block' : 'none';
  }

  /* =========================
     WALL
  ========================= */
  function createWall() {
    wallGrid.innerHTML = '';
    state.wallWindows = [];
    state.fixationTotals = {};

    const CAMS = [
      { id: 'CAM_01', type: 'PRIVATE_SUITE' },
      { id: 'CAM_02', type: 'SERVICE_CORRIDOR' },
      { id: 'CAM_03', type: 'STAIRWELL_C2' },
      { id: 'CAM_04', type: 'REAR_ENTRANCE' },
      { id: 'CAM_05', type: 'PARKING_LOT_A' },
      { id: 'CAM_06', type: 'OFFICE_DESK_03' },
    ];

    CAMS.forEach(cam => {
      const el = document.createElement('div');
      el.className = 'cam-window';
      el.dataset.type = cam.type;

      el.innerHTML = `
        <div class="cam-window-inner"></div>
        <div class="cam-label">${cam.type} / ${cam.id}</div>
        <div class="cam-rec">REC</div>
        <div class="cam-overlay"></div>
      `;

      wallGrid.appendChild(el);

      state.wallWindows.push({ el, type: cam.type });
      state.fixationTotals[cam.type] = 0;
    });
  }

  /* =========================
     GAZE
  ========================= */
  function initGaze() {
    if (!window.webgazer) return;

    webgazer
      .setGazeListener((data, t) => {
        if (!data) return;
        state.raw = { x: data.x, y: data.y, t, valid: true };
      })
      .begin()
      .then(() => {
        webgazer.showVideo(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        state.gazeEnabled = true;
      });
  }

  /* =========================
     MAIN LOOP
  ========================= */
  function tick() {
    if (state.gazeEnabled && state.raw.valid) {
      if (!state.smooth.valid) {
        state.smooth = { ...state.raw, valid: true };
      } else {
        state.smooth.x = lerp(state.smooth.x, state.raw.x, CFG.smoothAlpha);
        state.smooth.y = lerp(state.smooth.y, state.raw.y, CFG.smoothAlpha);
      }

      state.snapped = { ...state.smooth };

      state.dot.x = lerp(state.dot.x || state.snapped.x, state.snapped.x, CFG.dotEasing);
      state.dot.y = lerp(state.dot.y || state.snapped.y, state.snapped.y, CFG.dotEasing);

      if (state.currentScene === 'wall') {
        gazeDot.style.left = state.dot.x + 'px';
        gazeDot.style.top = state.dot.y + 'px';
      }
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
  };

  btnToLogs.onclick = () => switchScene('logs');
  btnToReport.onclick = () => switchScene('report');
  btnRestart.onclick = () => location.reload();

  /* =========================
     INIT
  ========================= */
  function init() {
    switchScene('loading');
    createWall();
    addLog('WINDOW system initialized.');
    tick();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
