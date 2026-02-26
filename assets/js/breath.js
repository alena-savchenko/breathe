// breath.js
(function () {
  // Настройки визуала / физики дыхания
  const SETTINGS = {
    backgroundColor: '#ffffff',
    centralDotRadius: 4,
    centralDotColor: '#444444',

    minRadiusFactor: 0.08,
    maxRadiusFactor: 0.4,
    baseRadiusFactor: 0.2,
    amplitudeFactor: 0.08,
    userMinMultiplier: 1.2,

    dragTargetEasing: 0.25,
    dragRadiusEasing: 0.12,

    syncFrames: 8,
    syncToleranceFactor: 0.2,

    lineWidth: 6,
    noiseSteps: 180,

    autoNoise: { amp: 8, freq: 4, speed: 0.9 },
    userNoise: { amp: 8, freq: 5, speed: 1.1 },

    autoColorIdle: 'rgba(80, 150, 255, 0.5)',
    autoColorSynced: 'rgba(80, 150, 255, 0.9)',
    autoGlowColor: 'rgba(80,150,255,0.9)',

    userColorIdle: 'rgba(180, 80, 255, 0.6)',
    userColorSynced: 'rgba(180, 80, 255, 0.95)',
    userGlowColor: 'rgba(200,120,255,0.9)'
  };

  const THEME_COLORS = {
    light: {
      backgroundColor: '#ffffff',
      centralDotColor: '#444444'
    },
    dark: {
      backgroundColor: '#10141d',
      centralDotColor: '#d8dde8'
    }
  };

  let currentTheme = 'light';

  const canvas = document.getElementById('breathCanvas');
  const ctx = canvas.getContext('2d');

  // ===== Скорость дыхания (внутри анимации) =====
  function breathsPerMinuteToRadPerSec(bpm) {
    return (bpm / 60) * (2 * Math.PI);
  }

  let breathingBpm = 6;
  let breathingSpeedRad = breathsPerMinuteToRadPerSec(breathingBpm);

  // ===== Состояние для анимации =====
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let dpr = window.devicePixelRatio || 1;

  let minR = 40;
  let maxR = 200;
  let baseRadius = 100;
  let amplitude = 40;

  let userRadius = 60;
  let rawRadius = 60;
  let targetRadius = 60;

  let isDragging = false;
  let isReleasing = false;
  let releaseStartTime = 0;
  let releaseStartRadius = 0;

  let syncCounter = 0;
  let lastCycleIndex = 0;

  const startTime = performance.now();

  // Колбэк для уведомления о завершении цикла дыхания
  let cycleHandler = null;

  // ===== Вспомогательные функции =====
  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cx = width / 2;
    cy = height / 2;

    const minSide = Math.min(width, height);
    minR = minSide * SETTINGS.minRadiusFactor;
    maxR = minSide * SETTINGS.maxRadiusFactor;
    baseRadius = minSide * SETTINGS.baseRadiusFactor;
    amplitude = minSide * SETTINGS.amplitudeFactor;

    const initial = minR * SETTINGS.userMinMultiplier;
    userRadius = initial;
    rawRadius = initial;
    targetRadius = initial;
  }

  function distance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function smoothStep(x) {
    return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  }

  function toCanvasCoords(event) {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  // ===== Обработка указателя (пользовательский круг) =====
  function onPointerDown(e) {
    e.preventDefault();
    const { x, y } = toCanvasCoords(e);
    const dist = distance(x, y, cx, cy);
    const clamped = clamp(dist, minR, maxR);
    rawRadius = clamped;
    targetRadius = clamped;

    isDragging = true;
    isReleasing = false;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const { x, y } = toCanvasCoords(e);
    const dist = distance(x, y, cx, cy);
    rawRadius = clamp(dist, minR, maxR);
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    e.preventDefault();
    isDragging = false;
    canvas.releasePointerCapture(e.pointerId);

    isReleasing = true;
    releaseStartTime = performance.now();
    releaseStartRadius = userRadius;
    const rest = minR * SETTINGS.userMinMultiplier;
    rawRadius = rest;
    targetRadius = rest;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', (e) => {
    if (!isDragging) return;
    onPointerUp(e);
  });

  window.addEventListener('resize', resize);
  resize();

  // ===== Рисование "неровного" круга =====
  function drawWobblyCircle(radius, time, options) {
    const {
      lineWidth = SETTINGS.lineWidth,
      color = 'rgba(0,0,0,0.6)',
      noiseAmp = 6,
      noiseFreq = 5,
      noiseSpeed = 1,
      glow = false,
      shadowColor = color
    } = options || {};

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'transparent';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (glow) {
      ctx.shadowBlur = 25;
      ctx.shadowColor = shadowColor;
    } else {
      ctx.shadowBlur = 0;
    }

    const steps = SETTINGS.noiseSteps;
    const dt = (Math.PI * 2) / steps;
    const t = time * noiseSpeed;

    ctx.beginPath();
    for (let i = 0; i < steps; i++) {
      const angle = i * dt;
      const noise =
        Math.sin(angle * noiseFreq + t) +
        0.5 * Math.sin(angle * (noiseFreq * 0.7) - t * 0.8);
      const r = radius + noise * noiseAmp;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // ===== Главный цикл отрисовки =====
  function loop(now) {
    requestAnimationFrame(loop);

    const tSec = (now - startTime) / 1000;
    const phaseAngle = breathingSpeedRad * tSec;
    const cycleIndex = Math.floor(phaseAngle / (2 * Math.PI));

    // Сообщаем о завершении цикла (для текста и т.п.)
    if (cycleIndex !== lastCycleIndex) {
      lastCycleIndex = cycleIndex;
      if (cycleIndex > 0 && typeof cycleHandler === 'function') {
        cycleHandler(cycleIndex);
      }
    }

    let r1 = baseRadius + amplitude * Math.sin(phaseAngle);
    r1 = clamp(r1, minR, maxR);

    const restRadius = minR * SETTINGS.userMinMultiplier;

    if (isDragging) {
      targetRadius =
        targetRadius +
        (rawRadius - targetRadius) * SETTINGS.dragTargetEasing;

      userRadius =
        userRadius +
        (targetRadius - userRadius) * SETTINGS.dragRadiusEasing;

      isReleasing = false;
    } else if (isReleasing) {
      const releaseDurationSec = Math.PI / breathingSpeedRad;
      const elapsedSec = (now - releaseStartTime) / 1000;
      const progress = smoothStep(
        clamp(elapsedSec / releaseDurationSec, 0, 1)
      );
      userRadius =
        releaseStartRadius +
        (restRadius - releaseStartRadius) * progress;

      if (progress >= 1) {
        isReleasing = false;
        userRadius = restRadius;
      }
    } else {
      userRadius =
        userRadius + (restRadius - userRadius) * SETTINGS.dragRadiusEasing;
    }

    const diff = Math.abs(r1 - userRadius);
    const radiusTolerance = baseRadius * SETTINGS.syncToleranceFactor;
    const inSyncNow = diff < radiusTolerance;

    if (inSyncNow) {
      syncCounter = Math.min(syncCounter + 1, SETTINGS.syncFrames);
    } else {
      syncCounter = Math.max(syncCounter - 1, -SETTINGS.syncFrames);
    }

    const isSynced = syncCounter >= SETTINGS.syncFrames;
    const visualSynced = isDragging && isSynced;

    // Фон
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = SETTINGS.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Центральная точка
    ctx.save();
    ctx.fillStyle = SETTINGS.centralDotColor;
    ctx.beginPath();
    ctx.arc(cx, cy, SETTINGS.centralDotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Авто-круг
    const autoColor = visualSynced
      ? SETTINGS.autoColorSynced
      : SETTINGS.autoColorIdle;

    drawWobblyCircle(r1, tSec, {
      color: autoColor,
      noiseAmp: SETTINGS.autoNoise.amp,
      noiseFreq: SETTINGS.autoNoise.freq,
      noiseSpeed: SETTINGS.autoNoise.speed,
      glow: visualSynced,
      shadowColor: SETTINGS.autoGlowColor
    });

    // Пользовательский круг
    const userColor = visualSynced
      ? SETTINGS.userColorSynced
      : SETTINGS.userColorIdle;

    drawWobblyCircle(userRadius, tSec + 10, {
      color: userColor,
      noiseAmp: SETTINGS.userNoise.amp,
      noiseFreq: SETTINGS.userNoise.freq,
      noiseSpeed: SETTINGS.userNoise.speed,
      glow: visualSynced,
      shadowColor: SETTINGS.userGlowColor
    });
  }

  requestAnimationFrame(loop);

  // ===== Публичный API для UI =====
  function setTheme(themeName) {
    currentTheme = themeName === 'dark' ? 'dark' : 'light';
    const colors = THEME_COLORS[currentTheme];
    SETTINGS.backgroundColor = colors.backgroundColor;
    SETTINGS.centralDotColor = colors.centralDotColor;
  }

  function getTheme() {
    return currentTheme;
  }

  function setBreathingSpeedBpm(bpm) {
    const safeBpm = Math.max(1, Number(bpm) || 1);
    breathingBpm = safeBpm;
    breathingSpeedRad = breathsPerMinuteToRadPerSec(safeBpm);
  }

  function getBreathingSpeedBpm() {
    return breathingBpm;
  }

  function onCycle(handler) {
    if (typeof handler === 'function') {
      cycleHandler = handler;
    } else {
      cycleHandler = null;
    }
  }

  window.BreathApp = {
    setTheme,
    getTheme,
    setBreathingSpeedBpm,
    getBreathingSpeedBpm,
    onCycle
  };

  setTheme('light');
})();
