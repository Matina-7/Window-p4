console.log('MAIN JS LOADED');

document.addEventListener('DOMContentLoaded', () => {

  /* ================= DOM ================= */

  const wall = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreEl = document.getElementById('score-voyeur');
  const gazeDot = document.getElementById('gaze-dot');
  const btnStart = document.getElementById('btn-start');

  const mediaPanel = document.getElementById('media-panel');
  const mediaVideo = document.getElementById('media-video');
  const mediaClose = document.getElementById('media-close');

  /* ================= GUARD ================= */

  if (!wall || !btnStart) {
    console.error('Required DOM missing');
    return;
  }

  /* ================= CAMERA DATA ================= */

  const CAMS = [
    { id: 'CAM_01', name: 'PRIVATE_SUITE' },
    { id: 'CAM_02', name: 'SERVICE_CORRIDOR' },
    { id: 'CAM_03', name: 'STAIRWELL_C2' },
    { id: 'CAM_04', name: 'REAR_ENTRANCE' },
    { id: 'CAM_05', name: 'PARKING_LOT_A' },
    { id: 'CAM_06', name: 'OFFICE_DESK_03' }
  ];

  /* ================= STATE（只定义一次） ================= */

  const state = {
    gaze: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    smooth: { x: window.innerWidth / 2, y: window.innerHeight / 2 },

    fixation: 0,
    current: null,
    voyeur: 0,

    ghostOccurred: false,

    cam01Played: false,
    cam02Played: false,

    running: false
  };

  /* ================= THRESHOLDS ================= */

  const THRESH = {
    L1: 0.4,
    L2: 0.9,
    L3: 1.4,
    GHOST: 2.2,
    MEDIA: 3.0
  };

  /* ================= BUILD WALL（只建一次） ================= */

  wall.innerHTML = '';

  CAMS.forEach(cam => {
    const el = document.createElement('div');
    el.className = 'cam';
    el.dataset.cam = cam.id;
    el.innerHTML = `
      <div class="cam-label">
        ${cam.name} / ${cam.id}
      </div>
    `;
    wall.appendChild(el);
  });

  const camEls = Array.from(document.querySelectorAll('.cam'));

  /* ================= MEDIA ================= */

  function closeMedia() {
    mediaPanel.classList.remove('show');
    mediaVideo.pause();
    mediaVideo.srcObject = null;
    mediaVideo.src = '';
  }

  if (mediaClose) {
    mediaClose.onclick = closeMedia;
  }

  /* ================= GAZE ================= */

  function smoothGaze() {
    state.smooth.x += (state.gaze.x - state.smooth.x) * 0.15;
    state.smooth.y += (state.gaze.y - state.smooth.y) * 0.15;
  }

  function hitTest() {
    return camEls.find(cam => {
      const r = cam.getBoundingClientRect();
      return (
        state.smooth.x >= r.left &&
        state.smooth.x <= r.right &&
        state.smooth.y >= r.top &&
        state.smooth.y <= r.bottom
      );
    });
  }

  /* ================= PHYSIOLOGICAL FIXATION ================= */

  function fixationIncrement(dt, f) {
    if (f < 0.6) return dt * 0.45;
    if (f < 1.6) return dt * 1.35;
    return dt * (1 + Math.sin(performance.now() * 0.01) * 0.15);
  }

  /* ================= HEARTBEAT ================= */

  function triggerHeartbeat() {
    document.body.classList.add('heartbeat');
    setTimeout(() => {
      document.body.classList.remove('heartbeat');
    }, 300);
  }

  /* ================= MAIN LOOP ================= */

  let last = performance.now();

  function loop(t) {
    if (!state.running) return;

    const dt = (t - last) / 1000;
    last = t;

    smoothGaze();

    gazeDot.style.left = state.smooth.x + 'px';
    gazeDot.style.top = state.smooth.y + 'px';

    camEls.forEach(c => c.className = 'cam');

    const hit = hitTest();

    if (hit) {
      hit.classList.add('gaze-enter');

      if (state.current !== hit) {
        state.current = hit;
        state.fixation = 0;
        state.cam01Played = false;
        state.cam02Played = false;
      } else {
        state.fixation += fixationIncrement(dt, state.fixation);
      }

      const camId = hit.dataset.cam;
      labelViewer.textContent = `${camId} – ${state.fixation.toFixed(1)}s`;

      if (state.fixation >= THRESH.L1) hit.classList.add('level-1');
      if (state.fixation >= THRESH.L2) hit.classList.add('level-2');
      if (state.fixation >= THRESH.L3) hit.classList.add('level-3');

      if (state.fixation >= THRESH.GHOST && !state.ghostOccurred) {
        state.ghostOccurred = true;
        hit.classList.add('ghost');
        triggerHeartbeat();
      }

      /* ===== MEDIA ===== */

      if (camId === 'CAM_01' && state.fixation >= THRESH.MEDIA && !state.cam01Played) {
        mediaPanel.classList.add('show');
        mediaVideo.src = 'suit.mov';
        mediaVideo.srcObject = null;
        mediaVideo.play();
        state.cam01Played = true;
      }

      if (camId === 'CAM_02' && state.fixation >= THRESH.MEDIA && !state.cam02Played) {
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
          mediaPanel.classList.add('show');
          mediaVideo.srcObject = stream;
          state.cam02Played = true;
        });
      }

      state.voyeur += dt;
      scoreEl.textContent = Math.floor(state.voyeur);

    } else {
      state.current = null;
      state.fixation = 0;
      labelViewer.textContent = 'None';
    }

    requestAnimationFrame(loop);
  }

  /* ================= START ================= */

  btnStart.onclick = () => {
    btnStart.disabled = true;

    webgazer.setGazeListener(data => {
      if (!data) return;
      state.gaze.x = data.x;
      state.gaze.y = data.y;
    }).begin();

    state.running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  };

});
