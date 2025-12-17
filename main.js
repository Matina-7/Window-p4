console.log("[WINDOW] boot");

const $ = (id) => document.getElementById(id);

const scenes = {
  start: $("scene-start"),
  wall: $("scene-wall"),
  logs: $("scene-logs"),
};

function go(sceneName) {
  Object.values(scenes).forEach(s => s.classList.remove("active"));
  scenes[sceneName].classList.add("active");
  console.log("[UI] go:", sceneName);
}

const btnStart = $("btn-start");
const btnLogs = $("btn-logs");
const btnBack = $("btn-back");

const grid = $("wall-grid");
const label = $("label");
const scoreEl = $("score");
const logbox = $("logbox");
const dot = $("gaze-dot");

let score = 0;
let lastFocused = null;
let tick = 0;

const LABELS = ["BEDROOM","KITCHEN","STAIRCASE","GARAGE","HALLWAY","STORAGE"];

function addLog(line) {
  const t = new Date().toLocaleTimeString();
  logbox.textContent = `[${t}] ${line}\n` + logbox.textContent;
}

function buildGrid() {
  grid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const cam = document.createElement("div");
    cam.className = "cam";
    cam.dataset.label = LABELS[i];

    cam.innerHTML = `
      <div class="cam-inner"></div>
      <div class="cam-label">${LABELS[i]} // CAM_0${i+1}</div>
    `;

    cam.addEventListener("click", () => focus(cam, "click"));
    grid.appendChild(cam);
  }
}

function focus(cam, reason="gaze") {
  if (lastFocused !== cam) {
    document.querySelectorAll(".cam").forEach(c => c.classList.remove("focused"));
    cam.classList.add("focused");
    lastFocused = cam;
    tick = 0;

    label.textContent = cam.dataset.label;
    addLog(`FOCUS -> ${cam.dataset.label} (${reason})`);
  }

  tick++;
  if (tick % 45 === 0) {
    score++;
    scoreEl.textContent = String(score);
  }
}

// mouse = temporary gaze simulator (so you can verify UI first)
window.addEventListener("mousemove", (e) => {
  if (!scenes.wall.classList.contains("active")) return;

  dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cam = el && el.closest && el.closest(".cam");
  if (cam) focus(cam, "mouse");
});

btnStart.addEventListener("click", () => {
  go("wall");
});

btnLogs.addEventListener("click", () => go("logs"));
btnBack.addEventListener("click", () => go("wall"));

buildGrid();
addLog("System ready. Mouse moves the red dot (temporary gaze simulator).");
