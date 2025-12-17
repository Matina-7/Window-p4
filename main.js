(() => {
  const wallGrid = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreVoyeur = document.getElementById('score-voyeur');
  const fixProgress = document.getElementById('fix-progress');
  const mainVideo = document.getElementById('main-video');
  const gazeDot = document.getElementById('gaze-dot');

  const CFG = {
    triggerTime: 2.0,
    ghostTime: 2.2,
    tickMs: 50
  };

  const state = {
    cams: [],
    current: null,
    fixation: 0,
    viewer: null,
    ghosted: false,
    score: 0,
    gaze: { x: 0, y: 0 }
  };

  function createWall() {
    const camIds = ['CAM_01','CAM_02','CAM_03','CAM_04','CAM_05','CAM_06'];
    wallGrid.innerHTML = '';
    state.cams = [];

    camIds.forEach(id => {
      const el = document.createElement('div');
      el.className = 'cam-window';
      el.innerHTML = `<div class="cam-label">${id}</div>`;
      wallGrid.appendChild(el);
      state.cams.push({ id, el });
    });
  }

  function hitTest(x, y) {
    return state.cams.find(c => {
      const r = c.el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
  }

  async function openMainViewer(camId) {
    if (state.viewer === camId) return;

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

    state.viewer = camId;
  }

  function loop() {
    gazeDot.style.left = state.gaze.x + 'px';
    gazeDot.style.top = state.gaze.y + 'px';

    const hit = hitTest(state.gaze.x, state.gaze.y);
    state.cams.forEach(c => c.el.classList.remove('gaze-enter'));

    if (!hit) {
      state.current = null;
      state.fixation = 0;
      fixProgress.style.width = '0%';
      labelViewer.textContent = 'None';
      return setTimeout(loop, CFG.tickMs);
    }

    hit.el.classList.add('gaze-enter');

    if (hit !== state.current) {
      state.current = hit;
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

    setTimeout(loop, CFG.tickMs);
  }

  function initGaze() {
    webgazer.setGazeListener(data => {
      if (!data) return;
      state.gaze.x = data.x;
      state.gaze.y = data.y;
    }).begin();

    webgazer.showVideo(false);
    webgazer.showFaceOverlay(false);
  }

  document.addEventListener('DOMContentLoaded', () => {
    createWall();
    initGaze();
    loop();
  });
})();
