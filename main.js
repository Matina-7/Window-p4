(() => {
  const wallGrid = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreVoyeur = document.getElementById('score-voyeur');
  const fixProgress = document.getElementById('fix-progress');
  const mainVideo = document.getElementById('main-video');
  const gazeDot = document.getElementById('gaze-dot');

  const btnStart = document.getElementById('btn-start');
  const btnCalibStart = document.getElementById('btn-calib-start');
  const calibrationOverlay = document.getElementById('calibration-overlay');

  const CFG = {
    triggerTime: 2.0,
    ghostTime: 2.2,
    tickMs: 50
  };

  const state = {
    windows: [],
    currentTarget: null,
    fixation: 0,
    viewerActive: null,
    ghosted: false,
    score: 0,
    gaze: { x: 0, y: 0, valid: false }
  };

  function createWall() {
    const cams = ['CAM_01','CAM_02','CAM_03','CAM_04','CAM_05','CAM_06'];
    wallGrid.innerHTML = '';
    state.windows = [];

    cams.forEach(id => {
      const el = document.createElement('div');
      el.className = 'cam-window';
      el.innerHTML = `<div class="cam-label">${id}</div>`;
      wallGrid.appendChild(el);
      state.windows.push({ id, el });
    });
  }

  function hitTest(x, y) {
    return state.windows.find(w => {
      const r = w.el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
  }

  async function openMainViewer(camId) {
    if (state.viewerActive === camId) return;

    mainVideo.pause();
    mainVideo.src = '';
    mainVideo.srcObject = null;

    if (camId === 'CAM_01') {
      mainVideo.src = 'suit.mov';
      await mainVideo.play();
    }

    if (camId === 'CAM_02') {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      mainVideo.srcObject = stream;
      await mainVideo.play();
    }

    state.viewerActive = camId;
  }

  function tick() {
    if (!state.gaze.valid) return setTimeout(tick, CFG.tickMs);

    gazeDot.style.left = state.gaze.x + 'px';
    gazeDot.style.top = state.gaze.y + 'px';

    const hit = hitTest(state.gaze.x, state.gaze.y);
    state.windows.forEach(w => w.el.classList.remove('gaze-enter'));

    if (!hit) {
      state.currentTarget = null;
      state.fixation = 0;
      fixProgress.style.width = '0%';
      labelViewer.textContent = 'None';
      return setTimeout(tick, CFG.tickMs);
    }

    hit.el.classList.add('gaze-enter');

    if (hit !== state.currentTarget) {
      state.currentTarget = hit;
      state.fixation = 0;
      state.ghosted = false;
    }

    state.fixation += CFG.tickMs / 1000;
    labelViewer.textContent = `${hit.id} – ${state.fixation.toFixed(2)}s`;

    fixProgress.style.width =
      Math.min(state.fixation / CFG.triggerTime, 1) * 100 + '%';

    if (state.fixation >= CFG.triggerTime) {
      openMainViewer(hit.id);
    }

    if (state.fixation >= CFG.ghostTime && !state.ghosted) {
      state.ghosted = true;
      document.body.classList.add('system-heartbeat');
      setTimeout(() => document.body.classList.remove('system-heartbeat'), 350);
    }

    state.score += CFG.tickMs / 1000;
    scoreVoyeur.textContent = Math.floor(state.score);

    setTimeout(tick, CFG.tickMs);
  }

  function initGaze() {
    webgazer.setGazeListener((data) => {
      if (!data) return;
      state.gaze = { x: data.x, y: data.y, valid: true };
    }).begin();

    webgazer.showVideo(false);
    webgazer.showFaceOverlay(false);
  }

  btnStart.onclick = () => calibrationOverlay.classList.remove('hidden');
  btnCalibStart.onclick = () => {
    calibrationOverlay.classList.add('hidden');
    initGaze();
  };

  document.addEventListener('DOMContentLoaded', () => {
    createWall();
    tick();
  });
})();
