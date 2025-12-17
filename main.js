// main.js - WINDOW v1 基础骨架 + 简单眼动点显示
(() => {
  // ==============
  // 0. 获取 DOM 元素
  // ==============
  const scenes = {
    loading: document.getElementById('scene-loading'),
    wall: document.getElementById('scene-wall'),
    logs: document.getElementById('scene-logs'),
    report: document.getElementById('scene-report'),
  };

  const btnStart = document.getElementById('btn-start');
  const btnToLogs = document.getElementById('btn-to-logs');
  const btnToReport = document.getElementById('btn-to-report');
  const btnRestart = document.getElementById('btn-restart');

  const loadingTextEl = document.getElementById('loading-text');
  const wallGrid = document.getElementById('wall-grid');
  const labelViewer = document.getElementById('label-viewer');
  const scoreVoyeur = document.getElementById('score-voyeur');
  const logLines = document.getElementById('log-lines');
  const reportTextEl = document.getElementById('report-text');

  const gazeDot = document.getElementById('gaze-dot');
  const gazeDotLogs = document.getElementById('gaze-dot-logs');

  const calibrationOverlay = document.getElementById('calibration-overlay');
  const btnCalibStart = document.getElementById('btn-calib-start');

  // ==============
  // 1. 全局状态（后面会用在“偷窥指数”“报告”等）
  // ==============
  const state = {
    currentScene: 'loading',
    wallWindows: [], // {el, type, fixationTime}
    voyeurScore: 0,
    gazeEnabled: false,
    gazePosition: { x: 0, y: 0 },
    gazeHistory: [], // 存一些点，后面可用于更复杂分析
  };

  // 监控窗口类型（决定偷窥标签）
  const WINDOW_TYPES = [
    'BEDROOM',
    'OFFICE',
    'CORRIDOR',
    'ELEVATOR',
    'LOBBY',
    'KITCHEN',
  ];

  // ==============
  // 2. 场景切换函数
  // ==============
  function switchScene(name) {
    state.currentScene = name;
    Object.entries(scenes).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });

    // 根据场景显示哪个 gaze 点
    if (name === 'wall') {
      gazeDot.style.display = 'block';
      gazeDotLogs.style.display = 'none';
    } else if (name === 'logs') {
      gazeDot.style.display = 'none';
      gazeDotLogs.style.display = 'block';
    } else {
      gazeDot.style.display = 'none';
      gazeDotLogs.style.display = 'none';
    }
  }

  // ==============
  // 3. 初始化加载页（打字机效果）
  // ==============
  function initLoadingScreen() {
    // Typed.js
    new Typed('#loading-text', {
      strings: [
        'Initializing WINDOW system...',
        'Connecting to remote CCTV grid...',
        'Preparing eye-tracking module...',
      ],
      typeSpeed: 40,
      backSpeed: 0,
      smartBackspace: false,
      loop: false,
    });

    btnStart.addEventListener('click', () => {
      // 打开简单的校准提示
      calibrationOverlay.classList.remove('hidden');
    });

    btnCalibStart.addEventListener('click', () => {
      calibrationOverlay.classList.add('hidden');
      initGaze();       // 开启眼动
      switchScene('wall'); // 进入监控墙
    });
  }

  // ==============
  // 4. 构建监控墙（静态 + 简单信息统计）
  // ==============
  function createWallGrid() {
    const total = 12; // 4 列 x 3 行
    for (let i = 0; i < total; i++) {
      const type = WINDOW_TYPES[i % WINDOW_TYPES.length];
      const camEl = document.createElement('div');
      camEl.className = 'cam-window';

      const inner = document.createElement('div');
      inner.className = 'cam-window-inner';
      inner.style.backgroundImage = `linear-gradient(135deg, #1e1e2f, #0d0f1a)`;

      const label = document.createElement('div');
      label.className = 'cam-label';
      label.textContent = `${type} / CAM_${String(i + 1).padStart(2, '0')}`;

      const rec = document.createElement('div');
      rec.className = 'cam-rec';
      rec.textContent = 'REC';

      camEl.appendChild(inner);
      camEl.appendChild(label);
      camEl.appendChild(rec);

      wallGrid.appendChild(camEl);

      state.wallWindows.push({
        el: camEl,
        type,
        fixationTime: 0,
      });

      // 点击某个窗口：暂时先让它改变右侧标签 & 加一点分数
      camEl.addEventListener('click', () => {
        labelViewer.textContent = `你主动点开了：${type}`;
        state.voyeurScore += type === 'BEDROOM' ? 10 : 4;
        updateVoyeurScoreDisplay();
      });
    }
  }

  function updateVoyeurScoreDisplay() {
    scoreVoyeur.textContent = state.voyeurScore.toFixed(0);
  }

  // ==============
  // 5. 日志后台：先做一个简单滚动日志
  // ==============
  function initLogsScene() {
    // 先生成一些基础日志
    const baseLogs = [
      '[SYSTEM] WINDOW daemon started.',
      '[CCTV] 12 remote channels connected.',
      '[EYE] Tracking module online.',
      '[RISK] Baseline level: LOW.',
    ];

    baseLogs.forEach((text) => addLogLine(text, false));

    // 点击按钮生成“报告”
    btnToReport.addEventListener('click', () => {
      generateReport();
      switchScene('report');
    });
  }

  function addLogLine(text, sensitive = false) {
    const line = document.createElement('div');
    line.className = 'log-line';
    if (sensitive) line.classList.add('sensitive');
    line.textContent = text;
    logLines.appendChild(line);

    // 保证一直滚到最底
    logLines.scrollTop = logLines.scrollHeight;
  }

  // ==============
  // 6. 报告页：先用非常简单的文本，后面再根据 gaze 数据变聪明
  // ==============
  function generateReport() {
    const totalFix = state.wallWindows.reduce((sum, w) => sum + w.fixationTime, 0);
    const bedroomFix = state.wallWindows
      .filter((w) => w.type === 'BEDROOM')
      .reduce((sum, w) => sum + w.fixationTime, 0);

    const bedroomRatio = totalFix > 0 ? (bedroomFix / totalFix) * 100 : 0;

    const text = `
      在本次体验中，系统记录了你在监控墙上的视线行为。
      虽然当前版本只统计了非常基础的停留时间，但仍然可以看到一些倾向：<br><br>
      · 你的总“偷窥指数”为：<b>${state.voyeurScore.toFixed(0)}</b><br>
      · 其中，大约有 <b>${bedroomRatio.toFixed(1)}%</b> 的视线时间停留在 BEDROOM 类型画面上。<br><br>
      在后续版本中，这些数据会被进一步细化，用来生成更具针对性的反监视反馈。
    `;

    reportTextEl.innerHTML = text;
  }

  // ==============
  // 7. 眼动模块（基础版）：初始化 WebGazer + 显示 gaze 点
  // ==============
  function initGaze() {
    // 如果 webgazer 没加载到，直接跳过，避免报错
    if (!window.webgazer) {
      console.warn('WebGazer 未加载，眼动功能关闭。');
      return;
    }

    // 关闭 WebGazer 自带的视频预览和红点（更干净）
    webgazer
      .setRegression('ridge') // 默认模型
      .setGazeListener((data, timestamp) => {
        if (!data) return;
        const x = data.x;
        const y = data.y;
        state.gazePosition = { x, y };
        state.gazeHistory.push({ x, y, t: timestamp });

        // 简单显示小点（根据当前场景选择不同元素）
        if (state.currentScene === 'wall') {
          gazeDot.style.left = x + 'px';
          gazeDot.style.top = y + 'px';
        } else if (state.currentScene === 'logs') {
          gazeDotLogs.style.left = x + 'px';
          gazeDotLogs.style.top = y + 'px';
        }
      })
      .begin()
      .then(() => {
        // 隐藏默认视频与小点（这些是 webgazer 内置的）
        if (webgazer.showVideo) webgazer.showVideo(false);
        if (webgazer.showFaceOverlay) webgazer.showFaceOverlay(false);
        if (webgazer.showFaceFeedbackBox) webgazer.showFaceFeedbackBox(false);

        state.gazeEnabled = true;
        console.log('[EYE] WebGazer started.');
      })
      .catch((err) => {
        console.error('WebGazer 启动失败：', err);
      });

    // 启动一个简单循环，每隔一点时间根据 gaze 更新监控墙“视线停留时间”
    setInterval(updateWallFixationsByGaze, 200);
  }

  // 计算某个点是否在某个元素里
  function pointInElement(x, y, el) {
    const rect = el.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  // 每 200ms 更新一次：当前 gaze 在哪个监控窗口，就给它加一点停留时间
  function updateWallFixationsByGaze() {
    if (state.currentScene !== 'wall' || !state.gazeEnabled) return;

    const { x, y } = state.gazePosition;
    const dt = 0.2; // 200ms = 0.2s

    let hitWindow = null;
    for (const w of state.wallWindows) {
      if (pointInElement(x, y, w.el)) {
        hitWindow = w;
        break;
      }
    }

    if (hitWindow) {
      hitWindow.fixationTime += dt;

      // 简单加一点偷窥指数：对 BEDROOM 加更多
      state.voyeurScore += hitWindow.type === 'BEDROOM' ? 0.3 : 0.1;
      updateVoyeurScoreDisplay();
    }
  }

  // ==============
  // 8. 进入日志场景、重新开始等按钮绑定
  // ==============
  function initSceneButtons() {
    btnToLogs.addEventListener('click', () => {
      switchScene('logs');

      // 进入日志时，可以额外添加几条“伪隐私”信息
      addLogLine('[SYSTEM] User moved to LOG CONSOLE.', false);
      addLogLine(
        '[TRACE] Approximated locale: UNKNOWN_CITY / UNKNOWN_REGION.',
        true
      );
    });

    btnRestart.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // ==============
  // 9. 初始化入口
  // ==============
  function init() {
    switchScene('loading');
    initLoadingScreen();
    createWallGrid();
    initLogsScene();
    initSceneButtons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
