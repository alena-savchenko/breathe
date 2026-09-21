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

  const RIBBON_PALETTES = {
    auto: [
      ['rgba(74,130,250,0.72)', 'rgba(130,190,255,0.78)', 'rgba(175,216,255,0.58)'],
      ['rgba(75,180,210,0.64)', 'rgba(133,221,231,0.72)', 'rgba(183,233,242,0.54)'],
      ['rgba(128,113,237,0.66)', 'rgba(171,155,250,0.74)', 'rgba(208,193,255,0.56)'],
      ['rgba(93,151,235,0.70)', 'rgba(151,201,249,0.76)', 'rgba(193,222,255,0.58)']
    ],
    user: [
      ['rgba(146,93,234,0.72)', 'rgba(190,143,250,0.78)', 'rgba(220,184,255,0.58)'],
      ['rgba(222,113,182,0.66)', 'rgba(246,162,207,0.74)', 'rgba(255,206,227,0.56)'],
      ['rgba(116,122,229,0.68)', 'rgba(166,175,248,0.74)', 'rgba(205,209,255,0.56)'],
      ['rgba(185,107,222,0.70)', 'rgba(222,155,242,0.78)', 'rgba(241,199,252,0.58)']
    ]
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
  let gradientsEnabled = true;
  let highContrast = false;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let phaseHandler = null;
  let lastPhase = null;

  const canvas = document.getElementById('breathCanvas');
  const ctx = canvas.getContext('2d');
  const interaction = document.getElementById('circleInteraction');

  // Each mode is described by the same phase model. Sizes are normalized
  // between the animation's minimum and maximum breathing radius.
  const FIXED_PATTERNS = {
    'long-exhale': [
      { type: 'inhale', duration: 4, from: 0, to: 1 },
      { type: 'longExhale', duration: 6, from: 1, to: 0 }
    ],
    box: [
      { type: 'inhale', duration: 4, from: 0, to: 1 },
      { type: 'pause', duration: 4, from: 1, to: 1 },
      { type: 'exhale', duration: 4, from: 1, to: 0 },
      { type: 'pause', duration: 4, from: 0, to: 0 }
    ],
    'physiological-sigh': [
      { type: 'inhale', duration: 2.5, from: 0, to: 0.9 },
      { type: 'topUp', duration: 1, from: 0.9, to: 1 },
      { type: 'longExhale', duration: 6.5, from: 1, to: 0 }
    ],
    'less-air': [
      { type: 'smallInhale', duration: 3, from: 0, to: 0.45 },
      { type: 'softExhale', duration: 5, from: 0.45, to: 0 },
      { type: 'pause', duration: 2, from: 0, to: 0 }
    ]
  };

  let breathingBpm = 6;
  let breathingMode = 'default';
  let activePattern = null;
  let activePatternDuration = 0;

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
  let patternStartTime = startTime;

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

  function rebuildPattern() {
    if (breathingMode === 'default') {
      const halfCycle = 30 / breathingBpm;
      activePattern = [
        { type: 'inhale', duration: halfCycle, from: 0, to: 1 },
        { type: 'exhale', duration: halfCycle, from: 1, to: 0 }
      ];
    } else {
      activePattern = FIXED_PATTERNS[breathingMode] || FIXED_PATTERNS['long-exhale'];
    }
    activePatternDuration = activePattern.reduce((sum, phase) => sum + phase.duration, 0);
  }

  function getPattern() {
    if (!activePattern) rebuildPattern();
    return activePattern;
  }

  function getBreathingStateAt(now) {
    const pattern = getPattern();
    const totalDuration = activePatternDuration;
    const elapsed = Math.max(0, (now - patternStartTime) / 1000);
    const cycleIndex = Math.floor(elapsed / totalDuration);
    const cycleElapsed = elapsed - cycleIndex * totalDuration;
    let phaseStart = 0;
    let phase = pattern[pattern.length - 1];

    for (const candidate of pattern) {
      if (cycleElapsed < phaseStart + candidate.duration) {
        phase = candidate;
        break;
      }
      phaseStart += candidate.duration;
    }

    const rawProgress = clamp((cycleElapsed - phaseStart) / phase.duration, 0, 1);
    const progress = phase.from === phase.to ? rawProgress : smoothStep(rawProgress);
    const level = phase.from + (phase.to - phase.from) * progress;
    const cycleProgress = cycleElapsed / totalDuration;

    return {
      phase: phase.type,
      level,
      cycleIndex,
      cycleProgress,
      cycleAngle: (cycleIndex + cycleProgress) * Math.PI * 2,
      totalDuration
    };
  }

  function getPhaseAngleAt(now) {
    return getBreathingStateAt(now).cycleAngle;
  }

  function getReleaseDuration() {
    const exhale = getPattern().find((phase) => phase.to < phase.from);
    return exhale ? exhale.duration : 3;
  }

  function toCanvasCoords(event) {
    return {
      x: event.clientX - canvas.getBoundingClientRect().left,
      y: event.clientY - canvas.getBoundingClientRect().top
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
    if (e.button !== 0) return;
    const { x, y } = toCanvasCoords(e);
    activePointers.set(e.pointerId, { x, y });
    syncInteractionMode();
    interaction.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!activePointers.has(e.pointerId)) return;
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

    if (interaction.hasPointerCapture(e.pointerId)) interaction.releasePointerCapture(e.pointerId);
    syncInteractionMode();
  }

  interaction.addEventListener('pointerdown', onPointerDown);
  interaction.addEventListener('pointermove', onPointerMove);
  interaction.addEventListener('pointerup', onPointerUp);
  interaction.addEventListener('pointercancel', onPointerUp);
  interaction.addEventListener('pointerleave', (e) => {
    if (!isDragging) return;
    onPointerUp(e);
  });

  interaction.addEventListener('lostpointercapture', onPointerUp);

  window.addEventListener('resize', resize);
  resize();

  function ribbonsEnabled() {
    return gradientsEnabled && !highContrast && !reducedMotion;
  }

  const RIBBON_STEPS = 96;
  const RIBBON_COS = new Float32Array(RIBBON_STEPS + 1);
  const RIBBON_SIN = new Float32Array(RIBBON_STEPS + 1);
  const RIBBON_OUTER = new Float32Array(RIBBON_STEPS + 1);
  const RIBBON_INNER = new Float32Array(RIBBON_STEPS + 1);
  for (let i = 0; i <= RIBBON_STEPS; i++) {
    const angle = i * Math.PI * 2 / RIBBON_STEPS;
    RIBBON_COS[i] = Math.cos(angle);
    RIBBON_SIN[i] = Math.sin(angle);
  }

  function ribbonWidth(radius) {
    // Scale with the thickness control, but keep the center of small circles open.
    return Math.min(radius * 0.45, SETTINGS.lineWidth * 4.8, (Math.min(width, height) / 2 - radius - 4) / 1.1);
  }

  function drawRibbonCircle(radius, time, options) {
    const { ribbonColors, gradientShift = 0, glow = false } = options;
    const band = ribbonWidth(radius);
    const drift = time * 0.16 + gradientShift;
    ctx.save();

    // Closed filled ribbons have smooth, varying widths instead of a heavy outline.
    for (let layer = 0; layer < 4; layer++) {
      const offset = layer * Math.PI * 0.5;
      const colors = ribbonColors[layer];
      for (let i = 0; i <= RIBBON_STEPS; i++) {
        const a = i * Math.PI * 2 / RIBBON_STEPS;
        const wave = Math.sin(a * 3 + drift + offset);
        const center = radius + band * (0.34 * wave + 0.18 * Math.sin(a * 2 - drift + offset));
        const halfWidth = band * (0.24 + 0.3 * (0.5 + 0.5 * Math.sin(a * 2 + offset - drift)));
        RIBBON_OUTER[i] = center + halfWidth;
        RIBBON_INNER[i] = center - halfWidth;
      }

      const angle = drift * 0.6 + offset;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      const fill = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      fill.addColorStop(0, colors[0]);
      fill.addColorStop(0.36, colors[1]);
      fill.addColorStop(0.56, currentTheme === 'dark' ? 'rgba(220,230,255,0.38)' : 'rgba(255,255,255,0.75)');
      fill.addColorStop(0.72, colors[2]);
      fill.addColorStop(1, colors[0]);
      ctx.globalAlpha = (layer === 0 ? 0.34 : 0.62) + (glow ? 0.1 : 0);
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let i = 0; i <= RIBBON_STEPS; i++) {
        const x = cx + RIBBON_OUTER[i] * RIBBON_COS[i];
        const y = cy + RIBBON_OUTER[i] * RIBBON_SIN[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = RIBBON_STEPS; i >= 0; i--) {
        ctx.lineTo(
          cx + RIBBON_INNER[i] * RIBBON_COS[i],
          cy + RIBBON_INNER[i] * RIBBON_SIN[i]
        );
      }
      ctx.closePath();
      ctx.fill();

      // A thin sheen along each fold gives depth without a pulsing glow.
      ctx.globalAlpha = currentTheme === 'dark' ? 0.2 : 0.42;
      ctx.strokeStyle = fill;
      ctx.lineWidth = Math.min(1.5, band * 0.08);
      ctx.beginPath();
      for (let i = 0; i <= RIBBON_STEPS; i++) {
        const x = cx + RIBBON_OUTER[i] * RIBBON_COS[i];
        const y = cy + RIBBON_OUTER[i] * RIBBON_SIN[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ===== Рисование "неровного" круга =====
  function drawWobblyCircle(radius, time, options) {
    if (ribbonsEnabled()) {
      drawRibbonCircle(radius, time, options);
      return;
    }
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

    if (reducedMotion) time = 0;
    ctx.save();
    ctx.lineWidth = lineWidth;
    if (gradientsEnabled && Array.isArray(gradientColors) && gradientColors.length >= 2) {
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

    if (glow && !reducedMotion) {
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
      const r = radius + (reducedMotion ? 0 : noise * noiseAmp);
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
    now = performance.now();

    const tSec = (now - startTime) / 1000;
    const breathingState = getBreathingStateAt(now);
    const phaseAngle = breathingState.cycleAngle;
    const cycleIndex = breathingState.cycleIndex;
    const phase = breathingState.phase;
    if (phase !== lastPhase) {
      lastPhase = phase;
      if (phaseHandler) phaseHandler(phase);
    }

    // Сообщаем о завершении цикла (для текста и т.п.)
    if (cycleIndex !== lastCycleIndex) {
      lastCycleIndex = cycleIndex;
      if (cycleIndex > 0 && typeof cycleHandler === 'function') {
        cycleHandler(cycleIndex);
      }
    }

    let r1 = baseRadius - amplitude + breathingState.level * amplitude * 2;
    r1 = clamp(r1, minR, maxR);

    const restRadius = minR * SETTINGS.userMinMultiplier;

    if (isDragging || isPinching) {
      targetRadius =
        targetRadius +
        (rawRadius - targetRadius) * SETTINGS.dragTargetEasing;

      userRadius =
        userRadius +
        (targetRadius - userRadius) * SETTINGS.dragRadiusEasing;

      isReleasing = false;
    } else if (isReleasing) {
      const releaseDurationSec = getReleaseDuration();
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

    // Only this small hit area reserves touch gestures; the rest of the scene scrolls.
    const hitRadius = userRadius + (ribbonsEnabled() ? ribbonWidth(userRadius) : SETTINGS.lineWidth / 2) + 12;
    interaction.style.width = interaction.style.height = `${hitRadius * 2}px`;
    interaction.style.left = `${cx - hitRadius}px`;
    interaction.style.top = `${cy - hitRadius}px`;

    const diff = Math.abs(r1 - userRadius);
    const radiusTolerance = baseRadius * SETTINGS.syncToleranceFactor;
    const inSyncNow = diff < radiusTolerance;

    if (inSyncNow) {
      syncCounter = Math.min(syncCounter + 1, SETTINGS.syncFrames);
    } else {
      syncCounter = Math.max(syncCounter - 1, -SETTINGS.syncFrames);
    }

    const isSynced = syncCounter >= SETTINGS.syncFrames;
    const visualSynced = (isDragging || isPinching) && isSynced;

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
      ribbonColors: RIBBON_PALETTES.auto,
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
      ribbonColors: RIBBON_PALETTES.user,
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

  function setGradientsEnabled(enabled) {
    gradientsEnabled = enabled !== false;
  }

  function getGradientsEnabled() {
    return gradientsEnabled;
  }

  function setBreathingSpeedBpm(bpm) {
    const safeBpm = Math.max(1, Number(bpm) || 1);
    const now = performance.now();
    const previousState = getBreathingStateAt(now);
    breathingBpm = safeBpm;
    rebuildPattern();
    if (breathingMode === 'default') {
      const newCycleDuration = 60 / breathingBpm;
      patternStartTime = now - previousState.cycleProgress * newCycleDuration * 1000;
    }
  }

  function getBreathingSpeedBpm() {
    return breathingBpm;
  }

  function setBreathingMode(mode) {
    breathingMode = mode === 'default' || FIXED_PATTERNS[mode] ? mode : 'default';
    rebuildPattern();
    patternStartTime = performance.now();
    lastCycleIndex = 0;
    lastPhase = null;
  }

  function getBreathingMode() {
    return breathingMode;
  }

  function getBreathingState() {
    const state = getBreathingStateAt(performance.now());
    return {
      phase: state.phase,
      level: state.level,
      cycleProgress: state.cycleProgress
    };
  }

  function onCycle(handler) {
    if (typeof handler === 'function') {
      cycleHandler = handler;
    } else {
      cycleHandler = null;
    }
  }

  window.BreathApp = {
    setHighContrast(enabled) { highContrast = !!enabled; },
    setReducedMotion(enabled) { reducedMotion = !!enabled; },
    onPhase(handler) {
      phaseHandler = handler;
      handler(getBreathingStateAt(performance.now()).phase);
    },
    setTheme,
    getTheme,
    getPhaseAngle,
    setLineWidth,
    getLineWidth,
    setGradientsEnabled,
    getGradientsEnabled,
    setBreathingSpeedBpm,
    getBreathingSpeedBpm,
    setBreathingMode,
    getBreathingMode,
    getBreathingState,
    onCycle
  };

  setTheme('light');
})();
