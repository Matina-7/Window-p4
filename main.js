(() => {
  const $ = (id) => document.getElementById(id);

  const sceneStart = $('scene-start');
  const sceneWall = $('scene-wall');
  const btnStart = $('btn-start');

  const cams = Array.from(document.querySelectorAll('.cam'));
  const labelViewer = $('label-viewer');
  const scoreEl = $('score-voyeur');
  const gazeDot = $('gaze-dot');
  const fixProgress = $('fix-progress');
  const eyeStability = $('eye-stability');

  const focusClose = $('focus-close');
  const focusVideo = $('focus-video');
  const focusPlaceholder = $('focus-placeholder');

  const ghostVideo = $('ghost-video');

  const THRESH = { L1: 0.4, L2: 0.9, L3: 1.4, GHOST: 2.2 };
  const OPEN_FEED_AT = 3.0; // CAM01/CAM02 open at >= 3s

  const state = {
    // gaze raw + smooth
    gaze: { x: innerWidth / 2, y: innerHeight / 2 },
    smooth: { x: innerWidth / 2, y: innerHeight / 2 },

    // fixation
    currentCam: null,
    fixation: 0,

    // scoring
    voyeur: 0,

    // jitter / stability
    jitter: 0,
    lastSmooth: { x: innerWidth / 2, y: innerHeight / 2 },

    // streams
    ghostStream: null,
    focusStream: null,

    // gating
    openedCam01: false,
    openedCam02: false,

    // ghost heartbeat cooldown
    lastGhostBeatAt: 0
  };

  // -------------------------
  // Scene control
  // -------------------------
  function showWall() {
    sceneStart.classList.remove('active');
    sceneWall.classList.add('active');
  }

  btnStart.addEventListener('click', async () => {
    showWall();
    await startEyeTracking();   // start webgazer
    await primeGhostStream();   // try to get webcam stream for ghost reflections (optional)
  });

  // -------------------------
  // Webgazer init (stable)
  // -------------------------
  async function startEyeTracking() {
    if (!window.webgazer) {
      console.warn('WebGazer not loaded.');
      return;
    }

    try {
      // A small stability improvement: show video preview off
      webgazer.showVideoPreview(false).showPredictionPoints(false);

      webgazer.setGazeListener((data) => {
        if (!data) return;
        state.gaze.x = data.x;
        state.gaze.y = data.y;
      }).begin();
    } catch (e) {
      console.error(e);
    }
  }

  // Optional webcam for ghost overlays (best-effort)
  async function primeGhostStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      state.ghostStream = stream;
      ghostVideo.srcObject = stream;
      // do not show this video; just keep stream alive for ghost reflections
    } catch (e) {
      // user may deny; ghost will still work as flash-only
      state.ghostStream = null;
    }
  }

  // -------------------------
  // Focus view (left) controls
  // -------------------------
  function openFocusWithFile(filePath) {
    closeFocus(); // stop previous
    focusPlaceholder.style.display = 'none';
    focusVideo.style.display = 'block';

    focusVideo.srcObject = null;
    focusVideo.src = filePath;
    focusVideo.muted = true;
    focusVideo.play().catch(() => {});
  }

  async function openFocusWithWebcam() {
    closeFocus(); // stop previous
    focusPlaceholder.style.display = 'none';
    focusVideo.style.display = 'block';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      state.focusStream = stream;
      focusVideo.srcObject = stream;
      focusVideo.play().catch(() => {});
    } catch (e) {
      console.warn('Webcam denied for focus view.');
      closeFocus();
    }
  }

  function closeFocus() {
    focusVideo.pause();
    focusVideo.removeAttribute('src');
    focusVideo.srcObject = null;

    if (state.focusStream) {
      state.focusStream.getTracks().forEach(t => t.stop());
      state.focusStream = null;
    }

    focusVideo.style.display = 'none';
    focusPlaceholder.style.display = 'flex';

    // reset opened flags ONLY for CAM02 (so it can reopen)
    state.openedCam02 = false;
  }

  focusClose.addEventListener('click', closeFocus);

  // -------------------------
  // Gaze smoothing + snap
  // -------------------------
  function smoothGaze() {
    const alpha = 0.18;
    const prevX = state.smooth.x;
    const prevY = state.smooth.y;

    state.smooth.x += (state.gaze.x - state.smooth.x) * alpha;
    state.smooth.y += (state.gaze.y - state.smooth.y) * alpha;

    const dx = state.smooth.x - prevX;
    const dy = state.smooth.y - prevY;
    const dist = Math.hypot(dx, dy);
    // accumulate jitter measure
    state.jitter = state.jitter * 0.92 + dist * 0.08;
  }

  function snapToNearestCam(x, y) {
    // snap if close to a cam center (helps "activate naturally")
    const SNAP_RADIUS = 90;

    let best = null;
    let bestD = Infinity;

    for (const cam of cams) {
      const r = cam.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) {
        bestD = d;
        best = cam;
      }
    }

    if (best && bestD <= SNAP_RADIUS) return best;
    return null;
  }

  function hitTestCam(x, y) {
    for (const cam of cams) {
      const r = cam.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return cam;
    }
    return null;
  }

  // -------------------------
  // Class management
  // -------------------------
  function clearCamClasses() {
    for (const cam of cams) {
      cam.classList.remove('gaze-enter','level-1','level-2','level-3','ghost');
    }
  }

  function applyFixationClasses(cam, f) {
    cam.classList.add('gaze-enter');
    if (f >= THRESH.L1) cam.classList.add('level-1');
    if (f >= THRESH.L2) cam.classList.add('level-2');
    if (f >= THRESH.L3) cam.classList.add('level-3');
    if (f >= THRESH.GHOST) cam.classList.add('ghost');
  }

  // -------------------------
  // Ghost heartbeat
  // -------------------------
  function triggerHeartbeat() {
    const now = performance.now();
    if (now - state.lastGhostBeatAt < 900) return; // cooldown
    state.lastGhostBeatAt = now;

    document.body.classList.add('ghost-heartbeat');
    setTimeout(() => document.body.classList.remove('ghost-heartbeat'), 520);
  }

  // -------------------------
  // Eye stability label
  // -------------------------
  function stabilityStars() {
    // jitter smaller => more stable
    const j = state.jitter;
    let stars = 1;
    if (j < 2) stars = 5;
    else if (j < 4) stars = 4;
    else if (j < 7) stars = 3;
    else if (j < 11) stars = 2;
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  // -------------------------
  // Main loop
  // -------------------------
  let last = performance.now();

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;

    smoothGaze();

    // dot
    if (gazeDot) {
      gazeDot.style.left = `${state.smooth.x}px`;
      gazeDot.style.top = `${state.smooth.y}px`;
    }

    clearCamClasses();

    // snap logic
    const snappedCam = snapToNearestCam(state.smooth.x, state.smooth.y);
    const hit = snappedCam || hitTestCam(state.smooth.x, state.smooth.y);

    if (!hit) {
      state.currentCam = null;
      state.fixation = 0;
      labelViewer.textContent = 'None';
      fixProgress.style.width = '0%';
      eyeStability.textContent = `EYE STABILITY: ${stabilityStars()}`;
      requestAnimationFrame(loop);
      return;
    }

    // fixation update
    if (state.currentCam !== hit) {
      state.currentCam = hit;
      state.fixation = 0;
      // per-cam gating resets on new target
    } else {
      state.fixation += dt;
    }

    const camId = hit.dataset.cam;

    // UI
    labelViewer.textContent = `Locked: ${camId} — Fixation: ${state.fixation.toFixed(2)}s`;
    const pct = Math.max(0, Math.min(100, (state.fixation / OPEN_FEED_AT) * 100));
    fixProgress.style.width = `${pct}%`;

    // classes
    applyFixationClasses(hit, state.fixation);

    // scoring
    state.voyeur += dt * (1 + Math.min(2, state.fixation)); // longer fixation = faster score
    scoreEl.textContent = Math.floor(state.voyeur);

    // eye stability
    eyeStability.textContent = `EYE STABILITY: ${stabilityStars()}`;

    // ghost trigger (>=2.2s) -> heartbeat
    if (state.fixation >= THRESH.GHOST) {
      triggerHeartbeat();
    }

    // CAM01 >= 3s -> suit.mov (only once until you leave CAM01)
    if (camId === 'CAM_01' && state.fixation >= OPEN_FEED_AT && !state.openedCam01) {
      openFocusWithFile('suit.mov');
      state.openedCam01 = true;
    }
    if (camId !== 'CAM_01') state.openedCam01 = false;

    // CAM02 >= 3s -> webcam focus view
    if (camId === 'CAM_02' && state.fixation >= OPEN_FEED_AT && !state.openedCam02) {
      openFocusWithWebcam();
      state.openedCam02 = true;
    }
    if (camId !== 'CAM_02') state.openedCam02 = false;

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

})();
