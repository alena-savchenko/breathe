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
    autoGradientIdle: ['rgba(64, 122, 255, 0.52)', 'rgba(110, 170, 255, 0.7)', 'rgba(150, 206, 255, 0.42)'],
    autoGradientSynced: ['rgba(70, 130, 255, 0.9)', 'rgba(125, 188, 255, 1)', 'rgba(175, 222, 255, 0.88)'],

    userColorIdle: 'rgba(180, 80, 255, 0.6)',
    userColorSynced: 'rgba(180, 80, 255, 0.95)',
    userGlowColor: 'rgba(200,120,255,0.9)',
    userGradientIdle: ['rgba(148, 90, 255, 0.58)', 'rgba(194, 120, 255, 0.74)', 'rgba(230, 155, 255, 0.5)'],
    userGradientSynced: ['rgba(160, 95, 255, 0.9)', 'rgba(214, 138, 255, 1)', 'rgba(238, 176, 255, 0.9)']
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
  let phaseBaseAngle = 0;

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
  let isPinching = false;
  let isReleasing = false;
  let releaseStartTime = 0;
  let releaseStartRadius = 0;

  const activePointers = new Map();

  let syncCounter = 0;
  let lastCycleIndex = 0;

  const startTime = performance.now();
  let phaseBaseTime = startTime;

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

  function getPhaseAngleAt(now) {
    const tSec = (now - phaseBaseTime) / 1000;
    return phaseBaseAngle + breathingSpeedRad * tSec;
  }

  function toCanvasCoords(event) {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  function getFirstPointerPos() {
    const iter = activePointers.values().next();
    return iter.done ? null : iter.value;
  }

  function getTwoPointerPositions() {
    const values = Array.from(activePointers.values());
    if (values.length < 2) return null;
    return [values[0], values[1]];
  }

  function beginRelease(now) {
    isDragging = false;
    isPinching = false;
    isReleasing = true;
    releaseStartTime = now;
    releaseStartRadius = userRadius;
    const rest = minR * SETTINGS.userMinMultiplier;
    rawRadius = rest;
    targetRadius = rest;
  }

  function syncInteractionMode() {
    const count = activePointers.size;

    if (count >= 2) {
      isPinching = true;
      isDragging = false;
      isReleasing = false;

      const pair = getTwoPointerPositions();
      if (pair) {
        const pinchDistance = distance(pair[0].x, pair[0].y, pair[1].x, pair[1].y);
        const pinchRadius = clamp(pinchDistance * 0.5, minR, maxR);
        rawRadius = pinchRadius;
        targetRadius = pinchRadius;
      }
      return;
    }

    if (count === 1) {
      isPinching = false;
      isDragging = true;
      isReleasing = false;

      const pointer = getFirstPointerPos();
      if (pointer) {
        const dist = distance(pointer.x, pointer.y, cx, cy);
        const clamped = clamp(dist, minR, maxR);
        rawRadius = clamped;
        targetRadius = clamped;
      }
      return;
    }

    if (isDragging || isPinching) {
      beginRelease(performance.now());
    } else {
      isDragging = false;
      isPinching = false;
    }
  }

  // ===== Обработка указателя (пользовательский круг) =====
  function onPointerDown(e) {
    e.preventDefault();
    const { x, y } = toCanvasCoords(e);
    activePointers.set(e.pointerId, { x, y });
    syncInteractionMode();
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!activePointers.has(e.pointerId)) return;
    e.preventDefault();
    const { x, y } = toCanvasCoords(e);
    activePointers.set(e.pointerId, { x, y });

    if (isPinching) {
      const pair = getTwoPointerPositions();
      if (!pair) return;
      const pinchDistance = distance(pair[0].x, pair[0].y, pair[1].x, pair[1].y);
      rawRadius = clamp(pinchDistance * 0.5, minR, maxR);
      return;
    }

    if (!isDragging) return;

    const dist = distance(x, y, cx, cy);
    rawRadius = clamp(dist, minR, maxR);
  }

  function onPointerUp(e) {
    const hadPointer = activePointers.delete(e.pointerId);
    if (!hadPointer) return;

    e.preventDefault();
    canvas.releasePointerCapture(e.pointerId);
    syncInteractionMode();
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
      gradientColors = null,
      gradientShift = 0,
      shimmerSpeed = 0.9,
      noiseAmp = 6,
      noiseFreq = 5,
      noiseSpeed = 1,
      glow = false,
      shadowColor = color
    } = options || {};

    ctx.save();
    ctx.lineWidth = lineWidth;
    if (Array.isArray(gradientColors) && gradientColors.length >= 2) {
      const angle = time * shimmerSpeed + gradientShift;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      const gradient = ctx.createLinearGradient(
        cx - dx,
        cy - dy,
        cx + dx,
        cy + dy
      );
      gradient.addColorStop(0, gradientColors[0]);
      if (gradientColors.length >= 3) {
        const middle = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * (shimmerSpeed * 1.3) + gradientShift));
        gradient.addColorStop(middle, gradientColors[1]);
        gradient.addColorStop(1, gradientColors[2]);
      } else {
        gradient.addColorStop(1, gradientColors[1]);
      }
      ctx.strokeStyle = gradient;
    } else {
      ctx.strokeStyle = color;
    }
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
    const phaseAngle = getPhaseAngleAt(now);
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

    const autoGradient = visualSynced
      ? SETTINGS.autoGradientSynced
      : SETTINGS.autoGradientIdle;

    drawWobblyCircle(r1, tSec, {
      color: autoColor,
      gradientColors: autoGradient,
      gradientShift: 0,
      shimmerSpeed: 0.85,
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

    const userGradient = visualSynced
      ? SETTINGS.userGradientSynced
      : SETTINGS.userGradientIdle;

    drawWobblyCircle(userRadius, tSec + 10, {
      color: userColor,
      gradientColors: userGradient,
      gradientShift: 1.8,
      shimmerSpeed: 1.1,
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

  function getPhaseAngle() {
    return getPhaseAngleAt(performance.now());
  }

  function getTheme() {
    return currentTheme;
  }

  function setLineWidth(width) {
    const safeWidth = Math.max(1, Number(width) || 1);
    SETTINGS.lineWidth = safeWidth;
  }

  function getLineWidth() {
    return SETTINGS.lineWidth;
  }

  function setBreathingSpeedBpm(bpm) {
    const safeBpm = Math.max(1, Number(bpm) || 1);
    const now = performance.now();
    phaseBaseAngle = getPhaseAngleAt(now);
    phaseBaseTime = now;
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
    getPhaseAngle,
    setLineWidth,
    getLineWidth,
    setBreathingSpeedBpm,
    getBreathingSpeedBpm,
    onCycle
  };

  setTheme('light');
})();
