(() => {
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
  const btnCalibStart = document.getElementById('btn-calib-start');

  const wallGrid = document.getElementById('wall-grid');
  const scoreVoyeur = document.getElementById('score-voyeur');
  const labelViewer = document.getElementById('label-viewer');
  const gazeDot = document.getElementById('gaze-dot');
  const gazeDotLogs = document.getElementById('gaze-dot-logs');

  const calibrationOverlay = document.getElementById('calibration-overlay');

  const state = {
    currentScene: 'loading',
    wallWindows: [],
    voyeurScore: 0,
    gazePos: { x: 0, y: 0 },
    gazeEnabled: false,
  };

  const WINDOW_TYPES = [
    'BEDROOM',
    'BEDROOM',
    'OFFICE',
    'CORRIDOR',
    'KITCHEN',
    'ELEVATOR',
  ];

  function switchScene(name) {
    state.currentScene = name;
    Object.entries(scenes).forEach(([k, el]) =>
      el.classList.toggle('active', k === name)
    );

    gazeDot.style.display = name === 'wall' ? 'block' : 'none';
    gazeDotLogs.style.display = name === 'logs' ? 'block' : 'none';
  }

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
        fixation: 0,
      });

      el.onclick = () => {
        labelViewer.textContent = `Focused on ${type}`;
        state.voyeurScore += type === 'BEDROOM' ? 8 : 3;
        updateScore();
      };
    }
  }

  function updateScore() {
    scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
  }

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

    setInterval(updateFixation, 200);
  }

  function updateFixation() {
    if (!state.gazeEnabled || state.currentScene !== 'wall') return;

    const { x, y } = state.gazePos;

    state.wallWindows.forEach((w) => {
      const r = w.el.getBoundingClientRect();
      if (x > r.left && x < r.right && y > r.top && y < r.bottom) {
        w.fixation += 0.2;
        state.voyeurScore += w.type === 'BEDROOM' ? 0.25 : 0.1;
      }
    });

    updateScore();
  }

  function init() {
    switchScene('loading');
    createWall();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
