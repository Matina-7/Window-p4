(() => {
  const scenes = {
    loading: document.getElementById('scene-loading'),
    wall: document.getElementById('scene-wall'),
    logs: document.getElementById('scene-logs'),
    report: document.getElementById('scene-report'),
    camViewer: document.getElementById('scene-cam-viewer'),
  };

  const wallGrid = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreVoyeur = document.getElementById('score-voyeur');
  const fixProgress = document.getElementById('fix-progress');

  const camVideo = document.getElementById('cam-video');
  const btnCloseCam = document.getElementById('btn-close-cam');

  const CFG = {
    ghostTime: 2.2,
    turnTime: 3.0
  };

  const state = {
    wallWindows: [],
    currentTarget: null,
    fixationS: 0,
    voyeurScore: 0,
    ghostTriggered: false
  };

  function switchScene(name) {
    Object.values(scenes).forEach(s => s.classList.remove('active'));
    scenes[name].classList.add('active');
  }

  /* =========================
     WALL SETUP
  ========================= */
  function createWall() {
    const cams = [
      { id: 'CAM_01', type: 'PRIVATE_SUITE' },
      { id: 'CAM_02', type: 'SERVICE_CORRIDOR' },
      { id: 'CAM_03', type: 'STAIRWELL_C2' },
      { id: 'CAM_04', type: 'REAR_ENTRANCE' },
      { id: 'CAM_05', type: 'PARKING_LOT_A' },
      { id: 'CAM_06', type: 'OFFICE_DESK_03' },
    ];

    wallGrid.innerHTML = '';
    state.wallWindows = [];

    cams.forEach(cam => {
      const el = document.createElement('div');
      el.className = 'cam-window';
      el.innerHTML = `
        <div class="cam-window-inner"></div>
        <div class="cam-label">${cam.type} / ${cam.id}</div>
        <div class="cam-rec">REC</div>
      `;

      el.addEventListener('click', () => openCamViewer(cam.id));

      wallGrid.appendChild(el);
      state.wallWindows.push({ el, id: cam.id, type: cam.type });
    });
  }

  /* =========================
     CAM VIEWER
  ========================= */
  async function openCamViewer(camId) {
    switchScene('camViewer');

    if (camId === 'CAM_01') {
      camVideo.src = 'suit.mov';   // ✅ GitHub 中的视频
      camVideo.play();
    }

    if (camId === 'CAM_02') {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      camVideo.srcObject = stream;
      camVideo.play();
    }
  }

  btnCloseCam.onclick = () => {
    camVideo.pause();
    camVideo.src = '';
    camVideo.srcObject = null;
    switchScene('wall');
  };

  /* =========================
     REACTION LOGIC (简化演示)
  ========================= */
  function simulateFixation(dt) {
    state.fixationS += dt;
    labelViewer.textContent = `Fixation: ${state.fixationS.toFixed(2)}s`;

    const pct = Math.min(state.fixationS / CFG.ghostTime, 1);
    fixProgress.style.width = (pct * 100) + '%';

    state.voyeurScore += dt * 10;
    scoreVoyeur.textContent = Math.floor(state.voyeurScore);

    if (state.fixationS >= CFG.ghostTime && !state.ghostTriggered) {
      state.ghostTriggered = true;
      document.body.classList.add('system-heartbeat');
      setTimeout(() => {
        document.body.classList.remove('system-heartbeat');
      }, 350);
    }
  }

  /* =========================
     INIT
  ========================= */
  function init() {
    switchScene('wall');
    createWall();

    // demo loop（你真实项目中这里接 gaze）
    setInterval(() => simulateFixation(0.05), 50);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
