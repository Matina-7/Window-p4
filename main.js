* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #05060a;
  color: #e5e5e5;
  font-family: system-ui, sans-serif;
  height: 100vh;
  overflow: hidden;
}

/* scenes */
.scene { position: absolute; inset: 0; display: none; }
.scene.active { display: flex; }

/* buttons */
.btn {
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid #444;
  background: #151725;
  color: white;
  cursor: pointer;
}
.btn.primary { background: #e53935; }

/* top bar */
.top-bar {
  height: 48px;
  border-bottom: 1px solid #222;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

/* layout */
.wall-layout {
  flex: 1;
  display: flex;
  height: calc(100vh - 48px);
}

/* LEFT MAIN VIEWER */
.main-viewer {
  width: 40%;
  background: black;
  display: flex;
  justify-content: center;
  align-items: center;
  border-right: 1px solid #222;
}

.main-viewer video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* RIGHT SIDE */
.right-area {
  flex: 1;
  display: flex;
}

/* GRID */
.wall-grid {
  flex: 3;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px;
}

.cam-window {
  position: relative;
  border: 1px solid #333;
  background: #0b0d18;
  border-radius: 8px;
}

/* immediate gaze highlight */
.cam-window.gaze-enter {
  border-color: #ef5350;
  box-shadow: 0 0 0 2px rgba(239,83,80,0.4);
}

.cam-label {
  position: absolute;
  bottom: 6px;
  left: 6px;
  font-size: 11px;
  background: rgba(0,0,0,0.6);
  padding: 3px 6px;
  border-radius: 6px;
}

/* SIDE PANEL */
.side-panel {
  width: 220px;
  border-left: 1px solid #222;
  padding: 10px;
}

.panel-block {
  border: 1px solid #333;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.score {
  font-size: 24px;
  color: #ef5350;
}

/* fixation bar */
.fix-bar {
  height: 6px;
  background: #222;
  border-radius: 999px;
  overflow: hidden;
  margin-top: 6px;
}
#fix-progress {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #ef5350, #ff867c);
}

/* gaze dot */
#gaze-dot {
  position: fixed;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(239,83,80,0.4);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

/* calibration */
.calibration {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
}
.calibration.hidden { display: none; }

/* HEARTBEAT */
.system-heartbeat {
  animation: heartbeat 0.35s ease-out;
}
@keyframes heartbeat {
  30% {
    box-shadow: inset 0 0 0 9999px rgba(239,83,80,0.12);
  }
}
