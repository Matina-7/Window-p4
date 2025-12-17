(() => {
  const scenes = {
    loading: document.getElementById("scene-loading"),
    wall: document.getElementById("scene-wall"),
    report: document.getElementById("scene-report"),
  };

  const wallGrid = document.getElementById("wall-grid");
  const gazeDot = document.getElementById("gaze-dot");
  const behaviorLabel = document.getElementById("behavior-label");
  const voyeurScoreEl = document.getElementById("voyeur-score");
  const reportText = document.getElementById("report-text");

  const btnStart = document.getElementById("btn-start");
  const btnRestart = document.getElementById("btn-restart");
  const btnToReport = document.getElementById("btn-to-report");

  const TYPES = ["BEDROOM", "OFFICE", "CORRIDOR", "ELEVATOR"];

  const state = {
    gaze: { x: 0, y: 0 },
    windows: [],
    voyeurScore: 0,
  };

  function switchScene(name) {
    Object.entries(scenes).forEach(([k, el]) => {
      el.classList.toggle("active", k === name);
    });
  }

  function createGrid() {
    for (let i = 0; i < 12; i++) {
      const type = TYPES[i % TYPES.length];
      const el = document.createElement("div");
      el.className = "cam";
      el.innerHTML = `<span>${type}</span>`;
      wallGrid.appendChild(el);

      state.windows.push({
        el,
        type,
        fixation: 0,
      });
    }
  }

  function pointIn(el, x, y) {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function updateFixation() {
    let hit = null;

    state.windows.forEach(w => {
      if (pointIn(w.el, state.gaze.x, state.gaze.y)) {
        hit = w;
      }
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

    if (maxVal / total > 0.45) {
      behaviorLabel.textContent = `${maxType} WATCHER`;
    } else {
      behaviorLabel.textContent = "SCANNING BEHAVIOR";
    }
  }

  function initGaze() {
    webgazer
      .setGazeListener((data) => {
        if (!data) return;
        state.gaze.x = data.x;
        state.gaze.y = data.y;
        gazeDot.style.left = data.x + "px";
        gazeDot.style.top = data.y + "px";
      })
      .begin();

    webgazer.showVideo(false);
    webgazer.showFaceOverlay(false);
    webgazer.showFaceFeedbackBox(false);

    setInterval(updateFixation, 200);
    setInterval(analyzeBehavior, 3000);
  }

  function generateReport() {
    const text = `
      The system analyzed your viewing behavior across multiple surveillance feeds.
      Your gaze showed persistent interest patterns rather than random exploration.

      Total Voyeur Score: ${state.voyeurScore.toFixed(0)}
      Dominant Behavior: ${behaviorLabel.textContent}

      In this system, looking is not passive.
      Observation itself leaves a trace.
    `;
    reportText.textContent = text;
  }

  btnStart.onclick = () => {
    switchScene("wall");
    initGaze();
  };

  btnToReport.onclick = () => {
    generateReport();
    switchScene("report");
  };

  btnRestart.onclick = () => location.reload();

  createGrid();
})();
