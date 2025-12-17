console.log('MAIN JS LOADED');

document.addEventListener('DOMContentLoaded', () => {

  const wall = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreEl = document.getElementById('score-voyeur');
  const gazeDot = document.getElementById('gaze-dot');
  const mainVideo = document.getElementById('main-video');

  if (!wall) {
    console.error('wall-grid not found');
    return;
  }

  /* ===== CAM DATA ===== */

  const CAMS = [
    { id: 'CAM_01', name: 'PRIVATE_SUITE' },
    { id: 'CAM_02', name: 'SERVICE_CORRIDOR' },
    { id: 'CAM_03', name: 'STAIRWELL_C2' },
    { id: 'CAM_04', name: 'REAR_ENTRANCE' },
    { id: 'CAM_05', name: 'PARKING_LOT_A' },
    { id: 'CAM_06', name: 'OFFICE_DESK_03' }
  ];

  /* ===== BUILD WALL ===== */

  wall.innerHTML = '';

  CAMS.forEach(cam => {
    const el = document.createElement('div');
    el.className = 'cam';
    el.dataset.cam = cam.id;
    el.innerHTML = `<div class="cam-label">${cam.name} / ${cam.id}</div>`;
    wall.appendChild(el);
  });

  /* ===== STATE ===== */

  const state = {
    gaze: { x: innerWidth / 2, y: innerHeight / 2 },
    smooth: { x: innerWidth / 2, y: innerHeight / 2 },
    fixation: 0,
    current: null,
    voyeur: 0,
    cam01Played: false,
    cam02Played: false
  };

  /* ===== WEBGAZER ===== */

  if (window.webgazer) {
    webgazer.setGazeListener(data => {
      if (!data) return;
      state.gaze.x = data.x;
      state.gaze.y = data.y;
    }).begin();
  }

  function smoothGaze() {
    state.smooth.x += (state.gaze.x - state.smooth.x) * 0.15;
    state.smooth.y += (state.gaze.y - state.smooth.y) * 0.15;
  }

  function hitTest() {
    return [...document.querySelectorAll('.cam')].find(cam => {
      const r = cam.getBoundingClie
