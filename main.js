console.log('MAIN JS START');

document.addEventListener('DOMContentLoaded', () => {

  console.log('DOM READY');

  const wall = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreEl = document.getElementById('score-voyeur');
  const gazeDot = document.getElementById('gaze-dot');
  const mainVideo = document.getElementById('main-video');

  if (!wall) {
    console.error('wall-grid NOT FOUND');
    return;
  }

  /* ===============================
     CAMERA DEFINITIONS
  =============================== */
  const CAMS = [
    { id: 'CAM_01', name: 'PRIVATE_SUITE' },
    { id: 'CAM_02', name: 'SERVICE_CORRIDOR' },
    { id: 'CAM_03', name: 'STAIRWELL_C2' },
    { id: 'CAM_04', name: 'REAR_ENTRANCE' },
    { id: 'CAM_05', name: 'PARKING_LOT_A' },
    { id: 'CAM_06', name: 'OFFICE_DESK_03' }
  ];

  /* ===============================
     BUILD WALL (关键部分)
  =============================== */
  wall.innerHTML = ''; // 防止残留

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

  console.log('CAM WALL BUILT:', wall.children.length);

  /* ===============================
     STATE
  =============================== */
  const state = {
    gaze: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    smooth: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    fixation: 0,
    current: null,
    voyeur: 0,
    cam01Played: false,
    cam02Played: false
  };

  /* ===============================
     WEBGAZER
  =============================== */
  webgazer.setGazeListener(data => {
    if (!data) return;
    state.gaze.x = data.x;
    state.gaze.y = data.y;
  }).begin();

  function smoothGaze() {
    state.smooth.x += (state.gaze.x - state.smooth.x) * 0.15;
    state.smooth.y += (state.gaze.y - state.smooth.y) * 0.15;
  }

  function hitTest() {
    return [...document.querySelectorAll('.cam')].find(cam => {
      const r = cam.getBoundingClientRect();
      return (
        state.smooth.x >= r.left &&
        state.smooth.x <= r.right &&
        state.smooth.y >= r.top &&
        state.smooth.y <= r.bottom
      );
    });
  }

  /* ===============================
     MAIN LOOP
  =============================== */
  let last = performance.now();

  function loop(t) {
    const dt = (t - last) / 1000;
    last = t;

    smoothGaze();

    gazeDot.style.left = state.smooth.x + 'px';
    gazeDot.style.top = state.smooth.y + 'px';

    document.querySelectorAll('.cam').forEach(c => {
      c.className = 'cam';
    });

    const hit = hitTest();

    if (hit) {
      hit.classList.add('gaze-enter');

      if (state.current !== hit) {
        state.current = hit;
        state.fixation = 0;
        state.cam01Played = false;
        state.cam02Played = false;
      } else {
        state.fixation += dt;
      }

      const camId = hit.dataset.cam;
      labelViewer.textContent = `${camId} – ${state.fixation.toFixed(1)}s`;

      if (state.fixation > 0.4) hit.classList.add('level-1');
      if (state.fixation > 0.9) hit.classList.add('level-2');
      if (state.fixation > 1.4) hit.classList.add('level-3');
      if (state.fixation > 2.2) hit.classList.add('ghost');

      /* VIDEO TRIGGERS */
      if (camId === 'CAM_01' && state.fixation >= 2 && !state.cam01Played) {
        mainVideo.srcObject = null;
        mainVideo.src = 'suit.mov';
        mainVideo.play();
        state.cam01Played = true;
      }

      if (camId === 'CAM_02' && state.fixation >= 2 && !state.cam02Played) {
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
          mainVideo.srcObject = stream;
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

  requestAnimationFrame(loop);
});
