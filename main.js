(() => {
  // ===== DOM =====
  const scenes = {
    loading: document.getElementById('scene-loading'),
    wall: document.getElementById('scene-wall'),
    logs: document.getElementById('scene-logs'),
    report: document.getElementById('scene-report'),
  };

  const btnStart = document.getElementById('btn-start');
  const btnToLogs = document.getElementById('btn-to-logs');
  const btnToReport = document.getElementById('btn-to-report');
  const btnRestart = document.getElementById('btn-restart');

  const loadingTextEl = document.getElementById('loading-text');
  const wallGrid = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreVoyeur = document.getElementById('score-voyeur');

  const logLines = document.getElementById('log-lines');
  const logSensitivity = document.getElementById('log-sensitivity');

  const reportTextEl = document.getElementById('report-text');

  const gazeDot = document.getElementById('gaze-dot');
  const gazeDotLogs = document.getElementById('gaze-dot-logs');

  const statusEye = document.getElementById('status-eye');
  const statusMode = document.getElementById('status-mode');

  const calibrationOverlay = document.getElementById('calibration-overlay');
  const btnCalibStart = document.getElementById('btn-calib-start');

  // ===== State =====
  const WINDOW_TYPES = ['BEDROOM', 'OFFICE', 'CORRIDOR', 'ELEVATOR', 'LOBBY', 'KITCHEN'];

  const state = {
    currentScene: 'loading',
    wallWindows: [], // { el, type, fixationTime }
    voyeurScore: 0,
    gazeEnabled: false,
    gazePosition: { x: 0, y: 0 },
    gazeHistory: [],
  };

  // ===== Scene switch =====
  function switchScene(name) {
    state.currentScene = name;
    Object.entries(scenes).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });

    if (name === 'wall') {
      gazeDot.style.display = 'block';
      gazeDotLogs.style.display = 'none';
    } else if (name === 'logs') {
      gazeDot.style.display = 'none';
      gazeDotLogs.style.display = 'block';
    } else {
      gazeDot.style.display = 'none';
      gazeDotLogs.style.display = 'none';
    }
  }

  // ===== UI =====
  function updateVoyeurScoreDisplay() {
    scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
  }

  // ===== Wall grid =====
  function createWallGrid() {
    wallGrid.innerHTML = '';
    state.wallWindows = [];

    const total = 12; // 4 x 3
    for (let i = 0; i < total; i++) {
      const type = WINDOW_TYPES[i % WINDOW_TYPES.length];

      const camEl = document.createElement('div');
      camEl.className = 'cam-window';

      const inner = document.createElement('div');
      inner.className = 'cam-window-inner';
      inner.style.backgroundImage = 'linear-gradient(135deg, #1e1e2f, #0d0f1a)';

      const label = document.createElement('div');
      label.className = 'cam-label';
      label.textContent = `${type} / CAM_${String(i + 1).padStart(2, '0')}`;

      const rec = document.createElement('div');
      rec.className = 'cam-rec';
      rec.textContent = 'REC';

      camEl.appendChild(inner);
      camEl.appendChild(label);
      camEl.appendChild(rec);
      wallGrid.appendChild(camEl);

      state.wallWindows.push({ el: camEl, type, fixationTime: 0 });
    }
  }

  // ===== Logs =====
  function addLogLine(text, sensitive = false) {
    const line = document.createElement('div');
    line.className = 'log-line';
    if (sensitive) line.classList.add('sensitive');
    line.textContent = text;
    logLines.appendChild(line);
    logLines.scrollTop = logLines.scrollHeight;
  }

  function initLogs() {
    logLines.innerHTML = '';
    addLogLine('[SYSTEM] WINDOW daemon online.');
    addLogLine('[CCTV] 12 channels connected.');
    addLogLine('[EYE] Tracking module ready.');
    addLogLine('[RISK] Baseline set to LOW.');
  }

  // ===== Report =====
  function generateReport() {
    const totalFix = state.wallWindows.reduce((sum, w) => sum + w.fixationTime, 0);
    const bedroomFix = state.wallWindows
      .filter(w => w.type === 'BEDROOM')
      .reduce((sum, w) => sum + w.fixationTime, 0);

    const bedroomRatio = totalFix > 0 ? (bedroomFix / totalFix) * 100 : 0;

    reportTextEl.innerHTML = `
      The system recorded your gaze behavior across the surveillance grid.<br><br>
      <b>Total Voyeur Score:</b> ${state.voyeurScore.toFixed(0)}<br>
      <b>Bedroom fixation ratio:</b> ${bedroomRatio.toFixed(1)}%<br><br>
      Looking is not passive inside WINDOW. Observation leaves a trace.
    `;
  }

  // ===== Gaze utils =====
  function pointInElement(x, y, el) {
    const rect = el.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function updateWallFixationsByGaze() {
    if (state.currentScene !== 'wall' || !state.gazeEnabled) return;

    const { x, y } = state.gazePosition;
    const dt = 0.2;

    let hitWindow = null;
    for (const w of state.wallWindows) {
      if (pointInElement(x, y, w.el)) {
        hitWindow = w;
        break;
      }
    }

    if (!hitWindow) return;

    hitWindow.fixationTime += dt;

    // score grows while looking
    state.voyeurScore += hitWindow.type === 'BEDROOM' ? 0.35 : 0.12;
    updateVoyeurScoreDisplay();

    // quick feedback label
    if (hitWindow.fixationTime > 1) {
      labelViewer.textContent = `BEHAVIOR: ${hitWindow.type} WATCHER`;
    }

    statusMode.textContent = `MODE: WATCHING ${hitWindow.type}`;
  }

  function updateViewerLabelByBehavior() {
    if (state.currentScene !== 'wall') return;

    let total = 0;
    const byType = {};

    state.wallWindows.forEach(w => {
      total += w.fixationTime;
      byType[w.type] = (byType[w.type] || 0) + w.fixationTime;
    });

    if (total < 3) return;

    let maxType = null;
    let maxValue = 0;
    for (const type in byType) {
      if (byType[type] > maxValue) {
        maxValue = byType[type];
        maxType = type;
      }
    }
    if (!maxType) return;

    const ratio = maxValue / total;
    labelViewer.textContent = ratio > 0.45 ? `BEHAVIOR: ${maxType} WATCHER` : 'BEHAVIOR: SCANNING';
  }

  // ===== WebGazer init =====
  function initGaze() {
    if (!window.webgazer) {
      loadingTextEl.textContent = 'WebGazer failed to load. Eye tracking disabled.';
      return;
    }

    statusEye.textContent = 'EYE: STARTING';

    webgazer
      .setRegression('ridge')
      .setGazeListener((data, timestamp) => {
        if (!data) return;

        state.gazePosition = { x: data.x, y: data.y };
        state.gazeHistory.push({ x: data.x, y: data.y, t: timestamp });

        if (state.currentScene === 'wall') {
          gazeDot.style.left = data.x + 'px';
          gazeDot.style.top = data.y + 'px';
        } else if (state.currentScene === 'logs') {
          gazeDotLogs.style.left = data.x + 'px';
          gazeDotLogs.style.top = data.y + 'px';
        }
      })
      .begin()
      .then(() => {
        webgazer.showVideo(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);

        state.gazeEnabled = true;
        statusEye.textContent = 'EYE: TRACKING';
      })
      .catch((err) => {
        console.error('WebGazer start failed:', err);
        statusEye.textContent = 'EYE: ERROR';
      });

    setInterval(updateWallFixationsByGaze, 200);
    setInterval(updateViewerLabelByBehavior, 3000);
  }

  // ===== Bindings =====
  function bindUI() {
    btnStart.addEventListener('click', () => {
      calibrationOverlay.classList.remove('hidden');
    });

    btnCalibStart.addEventListener('click', () => {
      calibrationOverlay.classList.add('hidden');
      initGaze();
      switchScene('wall');
    });

    btnToLogs.addEventListener('click', () => {
      initLogs();
      logSensitivity.textContent = 'Log console is live. (Next step: gaze-to-unlock logs)';
      switchScene('logs');
      addLogLine('[TRACE] User entered LOG CONSOLE.', true);
    });

    btnToReport.addEventListener('click', () => {
      generateReport();
      switchScene('report');
    });

    btnRestart.addEventListener('click', () => window.location.reload());
  }

  // ===== Boot =====
  function init() {
    switchScene('loading');
    createWallGrid();
    bindUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
