(() => {
  /* ---------- DOM ---------- */
  const scenes = {
    loading: document.getElementById("scene-loading"),
    wall: document.getElementById("scene-wall"),
    report: document.getElementById("scene-report")
  };

  const wallGrid = document.getElementById("wall-grid");
  const gazeDot = document.getElementById("gaze-dot");

  const behaviorLabel = document.getElementById("behavior-label");
  const voyeurScoreEl = document.getElementById("voyeur-score");
  const reportText = document.getElementById("report-text");
  const eyeStatus = document.getElementById("eye-status");

  const btnStart = document.getElementById("btn-start");
  const btnCalibrate = document.getElementById("btn-calibrate");
  const btnReport = document.getElementById("btn-to-report");
  const btnRestart = document.getElementById("btn-restart");

  const overlay = document.getElementById("calibration");

  /* ---------- STATE ---------- */
  const TYPES = ["BEDROOM", "OFFICE", "CORRIDOR", "ELEVATOR"];

  const state = {
    gaze: { x: 0, y: 0 },
    windows: [],
    voyeurScore: 0
  };

  /* ---------- SCENE ---------- */
  function switchScene(name) {
    Object.entries(scenes).forEach(([k, el]) =>
      el.classList.toggle("active", k === name)
    );
  }

  /* ---------- WALL ---------- */
  function buildWall() {
    for (let i = 0; i < 12; i++) {
      const type = TYPES[i % TYPES.length];
      const cam = document.createElement("div");
      cam.className = "cam";
      cam.innerHTML = `<span>${type}</span>`;
      wallGrid.appendChild(cam);

      state.windows.push({ el: cam, type, fixation: 0 });
    }
  }

  function pointIn(el, x, y) {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function updateFixation() {
    let hit = null;
    state.windows.forEach(w => {
      if (pointIn(w.el, state.gaze.x, state.gaze.y)) hit = w;
    });

    if (!hit) return;

    hit.fixation += 0.2;
    state.voyeurScore += hit.type === "BEDROOM" ? 0.4 : 0.15;
    voyeurScoreEl.textContent = state.voyeurScore.toFixed(0);

    if (hit.fixation > 1) {
      behaviorLabel.textContent = `${hit.type} WATCHER`;
    }
  }

  function analyzeBehavior() {
    const total = state.windows.reduce((s, w) => s + w.fixation, 0);
    if (total < 3) return;

    const byType = {};
    state.windows.forEach(w => {
      byType[w.type] = (byType[w.type] || 0) + w.fixation;
    });

    let maxType = null;
    let maxVal = 0;
    for (const t in byType) {
      if (byType[t] > maxVal) {
        maxVal = byType[t];
        maxType = t;
      }
    }

    behaviorLabel.textContent =
      maxVal / total > 0.45 ? `${maxType} WATCHER` : "SCANNING BEHAVIOR";
  }

  /* ---------- GAZE ---------- */
  function initGaze() {
    eyeStatus.textContent = "EYE: STARTING";

    webgazer
      .setGazeListener(data => {
        if (!data) return;
        state.gaze.x = data.x;
        state.gaze.y = data.y;
        gazeDot.style.left = data.x + "px";
        gazeDot.style.top = data.y + "px";
      })
      .begin()
      .then(() => {
        webgazer.showVideo(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        eyeStatus.textContent = "EYE: TRACKING";
      });

    setInterval(updateFixation, 200);
    setInterval(analyzeBehavior, 3000);
  }

  /* ---------- REPORT ---------- */
  function generateReport() {
    reportText.innerHTML = `
      The system analyzed how you observed the surveillance feeds.<br><br>
      <b>Voyeur Score:</b> ${state.voyeurScore.toFixed(0)}<br>
      <b>Detected Behavior:</b> ${behaviorLabel.textContent}<br><br>
      Observation is never neutral.
    `;
  }

  /* ---------- BIND ---------- */
  btnStart.onclick = () => overlay.classList.remove("hidden");
  btnCalibrate.onclick = () => {
    overlay.classList.add("hidden");
    switchScene("wall");
    initGaze();
  };
  btnReport.onclick = () => {
    generateReport();
    switchScene("report");
  };
  btnRestart.onclick = () => location.reload();

  /* ---------- INIT ---------- */
  buildWall();
})();

