// ……你原来的 IIFE 和变量定义全部保留……

// 新增状态
state.ghostOccurred = false;
state.finalShown = false;

/* ===== fixation 生理化函数 ===== */
function physiologicalFixationIncrement(dt, f) {
  if (f < 0.6) return dt * 0.45;        // 犹豫
  if (f < 1.6) return dt * 1.35;        // 锁定
  // 紧张抖动
  return dt * (1 + Math.sin(performance.now() * 0.01) * 0.15);
}

/* ===== 在主循环中替换 fixation 增长 ===== */
// 原来： state.fixation += dt;
state.fixation += physiologicalFixationIncrement(dt, state.fixation);

/* ===== Ghost 触发时加入余波 + 心理刀 ===== */
if (state.fixation >= THRESH.GHOST) {
  triggerHeartbeat();

  if (!state.ghostOccurred) {
    state.ghostOccurred = true;

    // 余波
    document.body.classList.add('post-ghost');
    setTimeout(() => document.body.classList.remove('post-ghost'), 1500);

    // 心理刀（只一次）
    if (!state.finalShown) {
      state.finalShown = true;
      const msg = document.getElementById('final-message');
      msg.classList.add('show');
      setTimeout(() => msg.classList.remove('show'), 3000);
    }
  }
}
