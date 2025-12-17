(() => {
  /* =========================
     DOM REFERENCES
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
  const scoreVoyeur = document.getElementById('score-voyeur');
  const labelViewer = document.getElementById('label-viewer');

  const gazeDot = document.getElementById('gaze-dot');
  const gazeDotLogs = document.getElementById('gaze-dot-logs');

  const calibrationOverlay = document.getElementById('calibration-overlay');

  /* =========================
     GLOBAL STATE
  ========================= */
  const state = {
    currentScene: 'loading',
    wallWindows: [],
    voyeurScore: 0,

    gazeEnabled: false,
    gazePos: { x: 0, y: 0 },

    currentFixationTarget: null,
    fixationTime: 0, // seconds
  };

  const FIXATION_THRESHOLD = 3.0; // seconds required for intentional gaze
  const FIXATION_INTERVAL = 0.2;  // seconds per update tick

  const WINDOW_TYPES = [
    'BEDROOM',
    'BEDROOM',
    'OFFICE',
    'CORRIDOR',
    'KITCHEN',
    'ELEVATOR',
  ];

  /* =========================
     SCENE CONTROL
  ========================= */
  function switchScene(name) {
    state.currentScene = name;

    Object.entries(scenes).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });

    gazeDot.style.display = name === 'wall' ? 'block' : 'none';
    gazeDotLogs.style.display = name === 'logs' ? 'block' : 'none';
  }

  /* =========================
     BUTTON EVENTS
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
     CCTV WALL CREATION
  ========================= */
  function createWall() {
    wallGrid.innerHTML = '';
    state.wallWindows = [];

    for (let i = 0; i < 6; i++) {
      const type = WINDOW_TYPES[i];
      const el = document.createElement('div');
      el.className = 'cam-window';

      el.innerHTML = `
        <div class="cam-window-inner"></div>
        <div class="cam-label">${type}</div>
        <div class="cam-rec">REC</div>
      `;

      wallGrid.appendChild(el);

      state.wallWindows.push({
        el,
        type,
        fixationAccumulated: 0,
        hasTriggered: false,
      });
    }
  }

  /* =========================
     VOYEUR SCORE UPDATE
  ========================= */
  function updateScore() {
    scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
  }

  /* =========================
     GAZE INITIALIZATION
  ========================= */
  function initGaze() {
    if (!window.webgazer) return;

    webgazer
      .setGazeListener((data) => {
        if (!data) return;

        state.gazePos = { x: data.x, y: data.y };

        if (state.currentScene === 'wall') {
          gazeDot.style.left = data.x + 'px';
          gazeDot.style.top = data.y + 'px';
        }
      })
      .begin()
      .then(() => {
        webgazer.showVideo(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        state.gazeEnabled = true;
      });

    setInterval(updateFixation, FIXATION_INTERVAL * 1000);
  }

  /* =========================
     FIXATION LOGIC (CORE)
  ========================= */
  function updateFixation() {
    if (!state.gazeEnabled || state.currentScene !== 'wall') return;

    const { x, y } = state.gazePos;
    let hitWindow = null;

    for (const w of state.wallWindows) {
      const rect = w.el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right &&
          y >= rect.top && y <= rect.bottom) {
        hitWindow = w;
        break;
      }
    }

    // If gaze moved to a different window, reset fixation
    if (hitWindow !== state.currentFixationTarget) {
      state.currentFixationTarget = hitWindow;
      state.fixationTime = 0;
    }

    // If gazing at a window, accumulate time
    if (hitWindow) {
      state.fixationTime += FIXATION_INTERVAL;

      // Trigger only once per window
      if (
        state.fixationTime >= FIXATION_THRESHOLD &&
        !hitWindow.hasTriggered
      ) {
        hitWindow.hasTriggered = true;
        hitWindow.fixationAccumulated += state.fixationTime;

        // Update voyeur score (bedroom is more sensitive)
        state.voyeurScore += hitWindow.type === 'BEDROOM' ? 12 : 6;
        updateScore();

        // Update UI label
        labelViewer.textContent = `Intentional focus detected: ${hitWindow.type}`;
      }
    } else {
      state.fixationTime = 0;
      state.currentFixationTarget = null;
    }
  }

  /* =========================
     INIT
  ========================= */
  function init() {
    switchScene('loading');
    createWall();
    updateScore();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
