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

  const CAMS = [
    {
      id: 'CAM_01',
      type: 'PRIVATE_SUITE',
      label: 'PRIVATE_SUITE / CAM_01',
    },
    {
      id: 'CAM_02',
      type: 'SERVICE_CORRIDOR',
      label: 'SERVICE_CORRIDOR / CAM_02',
    },
    {
      id: 'CAM_03',
      type: 'STAIRWELL_C2',
      label: 'STAIRWELL_C2 / CAM_03',
    },
    {
      id: 'CAM_04',
      type: 'REAR_ENTRANCE',
      label: 'REAR_ENTRANCE / CAM_04',
    },
    {
      id: 'CAM_05',
      type: 'PARKING_LOT_A',
      label: 'PARKING_LOT_A / CAM_05',
    },
    {
      id: 'CAM_06',
      type: 'OFFICE_DESK_03',
      label: 'OFFICE_DESK_03 / CAM_06',
    },
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
      triggeredLevel: 0,
    });
  });
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
  let hit = null;

  state.wallWindows.forEach(w => {
    w.el.classList.remove(
      'gaze-focus',
      'gaze-lv1',
      'gaze-lv2',
      'gaze-lv3',
      'gaze-ghost'
    );

    const r = w.el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      hit = w;
    }
  });

  if (!hit) {
    state.fixationTime = 0;
    state.currentFixationTarget = null;
    return;
  }

  hit.el.classList.add('gaze-focus');

  if (hit !== state.currentFixationTarget) {
    state.currentFixationTarget = hit;
    state.fixationTime = 0;
  }

  state.fixationTime += FIXATION_INTERVAL;

  if (state.fixationTime > 0.4) hit.el.classList.add('gaze-lv1');
  if (state.fixationTime > 0.9) hit.el.classList.add('gaze-lv2');
  if (state.fixationTime > 1.4) hit.el.classList.add('gaze-lv3');

  if (state.fixationTime > 2.2 && !hit.el.classList.contains('gaze-ghost')) {
    hit.el.classList.add('gaze-ghost');
    state.voyeurScore += 5;
    updateScore();
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
