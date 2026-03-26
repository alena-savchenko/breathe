// script.js
(function () {
  const DEFAULT_LANG = 'en';
  const DEFAULT_THEME = 'light';
  const DEFAULT_MESSAGE_DURATION_CYCLES = 2;
  const DEFAULT_HIGH_CONTRAST = false;
  const DEFAULT_LARGE_TEXT = false;
  const DEFAULT_NO_GRADIENTS = false;
  const DEFAULT_BIONIC_FONT = false;
  const TWO_PI = Math.PI * 2;
  const STORAGE_SCHEMA_VERSION = '2026-02-27T00:00:00Z';
  const STORAGE_VERSION_KEY = 'breath_storage_version';
  const FIRST_VISIT_TUTORIAL_SEEN_KEY = 'breath_first_visit_tutorial_seen';

  const TUTORIAL_STEP_SHOW_MS = 9500;
  const TUTORIAL_STEP_GAP_MS = 1800;
  const TUTORIAL_LONG_PAUSE_MS = 30000;

  const TUTORIAL_STEP_KEYS = [
    'tutorial.step1',
    'tutorial.step2',
    'tutorial.step3'
  ];

  const TUTORIAL_FALLBACK_TEXT = {
    'tutorial.step1': 'This is Breath slow. Follow the shape and breathe with its rhythm.',
    'tutorial.step2': 'You can control the violet line with mouse or touch. Try it now.',
    'tutorial.step3': 'Open Settings to customize the app. Keyboard navigation help is also there.'
  };

  function ensureStorageSchemaVersion() {
    try {
      const current = localStorage.getItem(STORAGE_VERSION_KEY);
      if (current === STORAGE_SCHEMA_VERSION) return;

      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('breath_')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
      });

      localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_SCHEMA_VERSION);
    } catch (_) {}
  }

  ensureStorageSchemaVersion();

  const SUPPORTED_LANGS = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'uk', label: 'Українська' },
    { code: 'de', label: 'Deutsch' }
  ];

  function getInitialLang() {
    const codes = SUPPORTED_LANGS.map(l => l.code);

    function normalizeLocale(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-');
    }

    try {
      const stored = normalizeLocale(localStorage.getItem('breath_lang'));
      if (stored && codes.includes(stored)) return stored;
    } catch (_) {}

    try {
      const candidates = [];
      if (Array.isArray(navigator.languages) && navigator.languages.length) {
        candidates.push(...navigator.languages);
      }
      if (navigator.language) {
        candidates.push(navigator.language);
      }

      for (const raw of candidates) {
        const normalized = normalizeLocale(raw);
        if (!normalized) continue;

        if (codes.includes(normalized)) return normalized;

        const base = normalized.split('-')[0];
        if (codes.includes(base)) return base;
      }
    } catch (_) {}

    return DEFAULT_LANG;
  }

  function getInitialTheme() {
    try {
      const stored = localStorage.getItem('breath_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (_) {}

    try {
      if (
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        return 'dark';
      }
    } catch (_) {}

    return DEFAULT_THEME;
  }

  let currentLang = getInitialLang();
  let currentTheme = getInitialTheme();

  // Фразы над анимацией
  let messages = [];
  let currentMessageIndex = 0;
  let cyclesSinceChange = 0;

  const fallbackEn = [
    'Breathe…<br>Inhale as the circle expands, exhale as it contracts.',
    'You can add feedback.<br>Press and hold the center circle.<br>Move outward as you inhale, inward as you exhale.',
    'Just breathe.'
  ];

  const fallbackRu = [
    'Дышите…<br>Вдыхайте, когда круг расширяется, и выдыхайте, когда он сужается.',
    'Можно добавить обратную связь.<br>Нажмите и удерживайте центр круга.<br>Когда вы вдыхаете — двигайтесь от центра, когда выдыхаете — к центру.',
    'Дышите.'
  ];

  // UI-строки (настройки, описание)
  let uiStrings = {};
  let messagesLoadToken = 0;
  let uiLoadToken = 0;
  let messageStartPhase = null;
  let isMessageTransitioning = false;
  let messageDurationCycles = DEFAULT_MESSAGE_DURATION_CYCLES;

  // DOM-элементы
  let textEl;
  let settingsToggle, settingsPanel, settingsBackdrop, settingsClose;
  let langToggle, langPanel, langClose, langList;
  let musicToggle, bgMusic;
  let musicVolumeSlider, musicVolumeValueEl;
  let quoteCyclesSlider, quoteCyclesValueEl;
  let lineWidthSlider, lineWidthValueEl;
  let speedSlider, speedValueEl;
  let tutorialReplayButton;
  let themeToggle;
  let highContrastToggle;
  let largeTextToggle;
  let noGradientsToggle;
  let bionicFontToggle;

  // Музыка
  let isMusicEnabled = false;
  let musicFadeFrame = 0;
  let musicPlayToken = 0;
  let isMusicLoadRequested = false;

  const MUSIC_FADE_IN_MS = 900;
  const MUSIC_START_VOLUME = 0.06;
  const DEFAULT_MUSIC_VOLUME_PERCENT = 35;

  let isHighContrastEnabled = DEFAULT_HIGH_CONTRAST;
  let isLargeTextEnabled = DEFAULT_LARGE_TEXT;
  let isNoGradientsEnabled = DEFAULT_NO_GRADIENTS;
  let isBionicFontEnabled = DEFAULT_BIONIC_FONT;
  let tutorialHintEl;
  let tutorialHintTextEl;
  let tutorialStepIndex = -1;
  let tutorialIsActive = false;
  let tutorialTimers = [];
  let hasKeyboardTabStarted = false;

  // ===== Парсеры текстов =====
  function parseMessagesText(text) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/\|/g, '<br>'));
  }

  function sanitizeHtml(html, allowedTags) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const allowed = new Set((allowedTags || []).map(tag => String(tag).toUpperCase()));

    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return;

      if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
        return;
      }

      const tag = node.tagName.toUpperCase();
      if (!allowed.has(tag)) {
        const parent = node.parentNode;
        if (!parent) return;

        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        node.remove();
        return;
      }

      while (node.attributes.length > 0) {
        node.removeAttribute(node.attributes[0].name);
      }

      Array.from(node.childNodes).forEach(sanitizeNode);
    }

    Array.from(template.content.childNodes).forEach(sanitizeNode);
    return template.innerHTML;
  }

  function parseKeyValueText(text) {
    const map = {};
    const lines = text.split('\n');
    let currentKey = null;

    function normalizeValue(value) {
      return value.replace(/\\?\|/g, '<br>');
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) {
        if (currentKey) {
          map[currentKey] += '\n' + normalizeValue(rawLine);
        }
        continue;
      }

      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();

      value = normalizeValue(value);

      if (key) {
        map[key] = value;
        currentKey = key;
      }
    }
    return map;
  }

  // ===== Работа с текстом над анимацией =====
  function setTextWithFade(newHtml) {
    if (!textEl) return;

    if (isNoGradientsEnabled) {
      textEl.innerHTML = sanitizeHtml(newHtml, ['br']);
      textEl.style.setProperty('--fill', '100%');
      textEl.style.opacity = 1;
      isMessageTransitioning = false;
      return;
    }

    textEl.style.opacity = 0;
    setTimeout(() => {
      textEl.innerHTML = sanitizeHtml(newHtml, ['br']);
      resetMessageFill();
      textEl.style.opacity = 1;
      isMessageTransitioning = false;
    }, 600);
  }

  function advanceToNextMessage() {
    if (
      isMessageTransitioning ||
      currentMessageIndex >= messages.length - 1
    ) {
      return;
    }

    isMessageTransitioning = true;
    currentMessageIndex += 1;
    cyclesSinceChange = 0;
    setTextWithFade(messages[currentMessageIndex]);
  }

  function getCurrentPhaseAngle() {
    if (
      !window.BreathApp ||
      typeof window.BreathApp.getPhaseAngle !== 'function'
    ) {
      return null;
    }

    const phase = window.BreathApp.getPhaseAngle();
    return Number.isFinite(phase) ? phase : null;
  }

  function resetMessageFill() {
    if (!textEl) return;
    if (isNoGradientsEnabled) {
      textEl.style.setProperty('--fill', '100%');
      messageStartPhase = null;
      return;
    }
    textEl.style.setProperty('--fill', '1%');
    const phase = getCurrentPhaseAngle();
    messageStartPhase = phase == null ? null : phase;
  }

  function updateMessageFillLoop() {
    requestAnimationFrame(updateMessageFillLoop);

    if (!textEl || !messages.length) return;

    if (isNoGradientsEnabled) {
      textEl.style.setProperty('--fill', '100%');
      return;
    }

    const currentPhase = getCurrentPhaseAngle();
    if (currentPhase == null) return;

    if (messageStartPhase == null || currentPhase < messageStartPhase) {
      messageStartPhase = currentPhase;
    }

    const totalPhase = messageDurationCycles * TWO_PI;
    const progress = clamp((currentPhase - messageStartPhase) / totalPhase, 0, 1);
    const fillPercent = (progress * 98) + 2;
    textEl.style.setProperty('--fill', fillPercent + '%');

    if (progress >= 0.96) {
      advanceToNextMessage();
    }
  }

  async function loadMessagesForLanguage(lang) {
    const token = ++messagesLoadToken;

    async function tryLoad(langCode) {
      const url = `./i18n/${langCode}/messages.txt`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const parsed = parseMessagesText(text);
      if (parsed.length === 0) throw new Error('Empty messages.txt');
      return parsed;
    }

    try {
      messages = await tryLoad(lang);
    } catch (e1) {
      console.warn(`Не удалось загрузить messages.txt для "${lang}":`, e1);
      try {
        messages = await tryLoad('en');
        console.warn('messages: используем английский фолбэк.');
      } catch (e2) {
        console.warn('messages: не удалось загрузить английский, используем встроенный.', e2);
        messages = fallbackEn.length ? fallbackEn : fallbackRu;
      }
    }

    if (token !== messagesLoadToken) return;

    currentMessageIndex = 0;
    cyclesSinceChange = 0;
    if (textEl) {
      textEl.innerHTML = sanitizeHtml(messages[0] || '', ['br']);
      resetMessageFill();
      requestAnimationFrame(() => {
        textEl.style.opacity = 1;
      });
    }
  }

  function handleCycleAdvance(cycleIndex) {
    if (cycleIndex <= 0 || !messages.length) return;
    cyclesSinceChange += 1;

    if (
      currentMessageIndex < messages.length - 1 &&
      cyclesSinceChange >= messageDurationCycles
    ) {
      advanceToNextMessage();
    }
  }

  // ===== UI-переводы (настройки, описание) =====
  async function loadUIStringsForLanguage(lang) {
    const token = ++uiLoadToken;

    async function tryLoad(langCode) {
      const url = `./i18n/${langCode}/ui.txt`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const parsed = parseKeyValueText(text);
      if (!Object.keys(parsed).length) throw new Error('Empty ui.txt');
      return parsed;
    }

    try {
      uiStrings = await tryLoad(lang);
    } catch (e1) {
      console.warn(`Не удалось загрузить ui.txt для "${lang}":`, e1);
      try {
        uiStrings = await tryLoad('en');
        console.warn('UI: используем английский фолбэк.');
      } catch (e2) {
        console.warn('UI: не удалось загрузить английский, оставляем встроенные тексты.', e2);
        uiStrings = {};
      }
    }

    if (token !== uiLoadToken) return;

    applyUIStrings();
  }

  async function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = currentLang;

    try {
      localStorage.setItem('breath_lang', currentLang);
    } catch (_) {}

    renderLangList();
    await Promise.all([
      loadMessagesForLanguage(currentLang),
      loadUIStringsForLanguage(currentLang)
    ]);
  }

  function applyUIStrings() {
    function setHtml(id, key, allowedTags) {
      const el = document.getElementById(id);
      if (!el) return;
      if (uiStrings[key]) {
        el.innerHTML = sanitizeHtml(uiStrings[key], allowedTags || []);
      }
    }

    function setAriaLabel(id, key) {
      const el = document.getElementById(id);
      if (!el) return;
      if (uiStrings[key]) {
        el.setAttribute('aria-label', uiStrings[key]);
      }
    }

    setHtml('i18n-language-title', 'language.title');
    setHtml('i18n-language-hint', 'language.hint');
    syncTutorialHintLanguage();

    setHtml('i18n-settings-title', 'settings.title');
    setHtml('i18n-settings-breathingSpeed-title', 'settings.breathingSpeed.title');

    setHtml('i18n-settings-breathsPerMinute-label', 'settings.breathsPerMinute.label');
    setHtml('i18n-settings-breathsPerMinute-hint', 'settings.breathsPerMinute.hint', ['br']);
    setHtml('i18n-settings-theme-title', 'settings.theme.title');
    setHtml('i18n-settings-theme-hint', 'settings.theme.hint', ['br']);
    setHtml('i18n-settings-accessibility-title', 'settings.accessibility.title');
    setHtml('i18n-settings-highContrast-title', 'settings.highContrast.title');
    setHtml('i18n-settings-highContrast-hint', 'settings.highContrast.hint', ['br']);
    setHtml('i18n-settings-largeText-title', 'settings.largeText.title');
    setHtml('i18n-settings-largeText-hint', 'settings.largeText.hint', ['br']);
    setHtml('i18n-settings-noGradients-title', 'settings.noGradients.title');
    setHtml('i18n-settings-noGradients-hint', 'settings.noGradients.hint', ['br']);
    setHtml('i18n-settings-bionicFont-title', 'settings.bionicFont.title');
    setHtml('i18n-settings-bionicFont-hint', 'settings.bionicFont.hint', ['br']);
    setHtml('i18n-settings-other-title', 'settings.other.title');
    setHtml('i18n-settings-quoteCycles-title', 'settings.quoteCycles.title');
    setHtml('i18n-settings-quoteCycles-label', 'settings.quoteCycles.label');
    setHtml('i18n-settings-quoteCycles-hint', 'settings.quoteCycles.hint', ['br']);
    setHtml('i18n-settings-lineWidth-title', 'settings.lineWidth.title');
    setHtml('i18n-settings-lineWidth-label', 'settings.lineWidth.label');
    setHtml('i18n-settings-lineWidth-hint', 'settings.lineWidth.hint', ['br']);
    setHtml('i18n-settings-tutorialReplay-title', 'settings.tutorialReplay.title');
    setHtml('tutorialReplayButton', 'settings.tutorialReplay.button', ['br']);
    setHtml('i18n-settings-tutorialReplay-hint', 'settings.tutorialReplay.hint', ['br']);
    setHtml('i18n-settings-musicVolume-title', 'settings.musicVolume.title');
    setHtml('i18n-settings-musicVolume-label', 'settings.musicVolume.label');
    setHtml('i18n-settings-musicVolume-hint', 'settings.musicVolume.hint', ['br']);

    setHtml('i18n-description-title', 'description.title');
    setHtml('i18n-description-body', 'description.body', ['br']);
    setHtml('i18n-footer-created-by', 'footer.createdBy');
    setHtml('i18n-footer-view-github', 'footer.viewOnGitHub');

    setAriaLabel('langToggle', 'buttons.langToggle.ariaLabel');
    setAriaLabel('settingsToggle', 'buttons.settingsToggle.ariaLabel');
    setAriaLabel('themeToggle', 'settings.theme.ariaLabel');
    setAriaLabel('highContrastToggle', 'settings.highContrast.ariaLabel');
    setAriaLabel('largeTextToggle', 'settings.largeText.ariaLabel');
    setAriaLabel('noGradientsToggle', 'settings.noGradients.ariaLabel');
    setAriaLabel('bionicFontToggle', 'settings.bionicFont.ariaLabel');
    setAriaLabel('tutorialReplayButton', 'settings.tutorialReplay.ariaLabel');
    updateMusicToggleAriaLabel();
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function hasStoredKey(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (_) {
      return false;
    }
  }

  function mediaQueryMatches(query) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch (_) {
      return false;
    }
  }

  function getSystemHighContrastPreference() {
    return (
      mediaQueryMatches('(prefers-contrast: more)') ||
      mediaQueryMatches('(forced-colors: active)')
    );
  }

  function getSystemReducedMotionPreference() {
    return mediaQueryMatches('(prefers-reduced-motion: reduce)');
  }

  function readStoredBool(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
    } catch (_) {}
    return !!defaultValue;
  }

  function writeStoredBool(key, value) {
    try {
      localStorage.setItem(key, value ? '1' : '0');
    } catch (_) {}
  }

  function applyHighContrast(enabled, persist) {
    isHighContrastEnabled = !!enabled;
    document.body.classList.toggle('high-contrast', isHighContrastEnabled);
    if (highContrastToggle) {
      highContrastToggle.checked = isHighContrastEnabled;
    }
    if (persist !== false) {
      writeStoredBool('breath_high_contrast', isHighContrastEnabled);
    }
  }

  function applyLargeText(enabled, persist) {
    isLargeTextEnabled = !!enabled;
    document.body.classList.toggle('large-text', isLargeTextEnabled);
    if (largeTextToggle) {
      largeTextToggle.checked = isLargeTextEnabled;
    }
    if (persist !== false) {
      writeStoredBool('breath_large_text', isLargeTextEnabled);
    }
  }

  function applyNoGradients(enabled, persist) {
    isNoGradientsEnabled = !!enabled;
    document.body.classList.toggle('no-gradients', isNoGradientsEnabled);

    if (noGradientsToggle) {
      noGradientsToggle.checked = isNoGradientsEnabled;
    }

    if (window.BreathApp && typeof window.BreathApp.setGradientsEnabled === 'function') {
      window.BreathApp.setGradientsEnabled(!isNoGradientsEnabled);
    }

    if (isNoGradientsEnabled) {
      if (textEl) {
        textEl.style.setProperty('--fill', '100%');
      }
    } else {
      resetMessageFill();
    }

    if (persist !== false) {
      writeStoredBool('breath_no_gradients', isNoGradientsEnabled);
    }
  }

  function applyBionicFont(enabled, persist) {
    isBionicFontEnabled = !!enabled;
    document.body.classList.toggle('bionic-font', isBionicFontEnabled);
    if (bionicFontToggle) {
      bionicFontToggle.checked = isBionicFontEnabled;
    }
    if (persist !== false) {
      writeStoredBool('breath_bionic_font', isBionicFontEnabled);
    }
  }

  function initializeSpecialNeedsPreferences() {
    const hasHighContrast = hasStoredKey('breath_high_contrast');
    const hasLargeText = hasStoredKey('breath_large_text');
    const hasNoGradients = hasStoredKey('breath_no_gradients');
    const hasBionicFont = hasStoredKey('breath_bionic_font');

    isHighContrastEnabled = hasHighContrast
      ? readStoredBool('breath_high_contrast', DEFAULT_HIGH_CONTRAST)
      : getSystemHighContrastPreference();

    isLargeTextEnabled = hasLargeText
      ? readStoredBool('breath_large_text', DEFAULT_LARGE_TEXT)
      : DEFAULT_LARGE_TEXT;

    isNoGradientsEnabled = hasNoGradients
      ? readStoredBool('breath_no_gradients', DEFAULT_NO_GRADIENTS)
      : getSystemReducedMotionPreference();

    isBionicFontEnabled = hasBionicFont
      ? readStoredBool('breath_bionic_font', DEFAULT_BIONIC_FONT)
      : DEFAULT_BIONIC_FONT;

    if (!hasHighContrast) {
      writeStoredBool('breath_high_contrast', isHighContrastEnabled);
    }
    if (!hasLargeText) {
      writeStoredBool('breath_large_text', isLargeTextEnabled);
    }
    if (!hasNoGradients) {
      writeStoredBool('breath_no_gradients', isNoGradientsEnabled);
    }
    if (!hasBionicFont) {
      writeStoredBool('breath_bionic_font', isBionicFontEnabled);
    }
  }

  function getMusicVolumeFromSlider() {
    if (!musicVolumeSlider) return 0;
    const raw = parseInt(musicVolumeSlider.value || '0', 10);
    const safe = Number.isFinite(raw) ? raw : 0;
    return clamp(safe, 0, 100) / 100;
  }

  function updateMusicVolumeLabel(volume01) {
    if (!musicVolumeValueEl) return;
    const percent = Math.round(clamp(volume01, 0, 1) * 100);
    musicVolumeValueEl.textContent = percent + '%';
  }

  function ensureMusicLoadRequested() {
    if (!bgMusic || isMusicLoadRequested) return;
    isMusicLoadRequested = true;
    try {
      bgMusic.load();
    } catch (_) {}
  }

  function cancelMusicFade() {
    if (musicFadeFrame) {
      cancelAnimationFrame(musicFadeFrame);
      musicFadeFrame = 0;
    }
  }

  function fadeMusicVolumeTo(targetVolume, durationMs) {
    if (!bgMusic) return;

    cancelMusicFade();

    const startVolume = clamp(bgMusic.volume, 0, 1);
    const endVolume = clamp(targetVolume, 0, 1);
    const startTime = performance.now();
    const duration = Math.max(1, durationMs || 1);

    function step(now) {
      const progress = clamp((now - startTime) / duration, 0, 1);
      bgMusic.volume = startVolume + (endVolume - startVolume) * progress;

      if (progress < 1 && isMusicEnabled) {
        musicFadeFrame = requestAnimationFrame(step);
      } else {
        musicFadeFrame = 0;
        bgMusic.volume = endVolume;
      }
    }

    musicFadeFrame = requestAnimationFrame(step);
  }

  function updateMusicPlaybackRate() {
    if (!bgMusic || !speedSlider) return;

    const bpm = parseInt(speedSlider.value || '6', 10);
    const safeBpm = Number.isFinite(bpm) ? bpm : 6;
    const baseBpm = 6;
    const ratio = safeBpm / baseBpm;
    const minRate = 0.5;
    const maxRate = 2;

    bgMusic.playbackRate = Math.min(maxRate, Math.max(minRate, ratio));
  }

  function updateMusicToggleAriaLabel() {
    if (!musicToggle) return;

    const key = isMusicEnabled
      ? 'buttons.musicToggleOn.ariaLabel'
      : 'buttons.musicToggleOff.ariaLabel';

    const fallback = isMusicEnabled ? 'Disable music' : 'Enable music';
    const value = uiStrings[key] || fallback;
    musicToggle.setAttribute('aria-label', value);
    musicToggle.setAttribute('aria-pressed', isMusicEnabled ? 'true' : 'false');
  }

  function setMusicEnabled(enabled) {
    if (!musicToggle || !bgMusic) return;

    const token = ++musicPlayToken;
    const nextEnabled = !!enabled;
    let targetVolume = getMusicVolumeFromSlider();

    if (nextEnabled && targetVolume <= 0 && musicVolumeSlider) {
      musicVolumeSlider.value = String(DEFAULT_MUSIC_VOLUME_PERCENT);
      targetVolume = getMusicVolumeFromSlider();
      updateMusicVolumeLabel(targetVolume);
    }

    if (!nextEnabled || targetVolume <= 0) {
      cancelMusicFade();
      bgMusic.pause();
      isMusicEnabled = false;
      musicToggle.classList.remove('is-on');
      updateMusicToggleAriaLabel();
      return;
    }

    ensureMusicLoadRequested();
    updateMusicPlaybackRate();
    cancelMusicFade();
    bgMusic.volume = Math.min(MUSIC_START_VOLUME, targetVolume);
    const playResult = bgMusic.play();

    if (playResult && typeof playResult.then === 'function') {
      playResult
        .then(() => {
          if (token !== musicPlayToken) return;
          isMusicEnabled = true;
          musicToggle.classList.add('is-on');
          updateMusicToggleAriaLabel();
          fadeMusicVolumeTo(targetVolume, MUSIC_FADE_IN_MS);
        })
        .catch((err) => {
          if (token !== musicPlayToken) return;
          isMusicEnabled = false;
          musicToggle.classList.remove('is-on');
          updateMusicToggleAriaLabel();
          console.warn('Не удалось запустить музыку:', err);
        });
      return;
    }

    isMusicEnabled = !bgMusic.paused;
    if (isMusicEnabled) {
      musicToggle.classList.add('is-on');
      updateMusicToggleAriaLabel();
      fadeMusicVolumeTo(targetVolume, MUSIC_FADE_IN_MS);
    } else {
      musicToggle.classList.remove('is-on');
      updateMusicToggleAriaLabel();
    }
  }

  function toggleMusic() {
    ensureMusicLoadRequested();
    setMusicEnabled(!isMusicEnabled);
  }

  function initMusicVolumeSlider() {
    if (!musicVolumeSlider) return;

    const initialVolume = getMusicVolumeFromSlider();
    updateMusicVolumeLabel(initialVolume);

    musicVolumeSlider.addEventListener('input', () => {
      const volume = getMusicVolumeFromSlider();
      updateMusicVolumeLabel(volume);

      if (volume <= 0) {
        setMusicEnabled(false);
        return;
      }

      if (!isMusicEnabled) {
        ensureMusicLoadRequested();
        setMusicEnabled(true);
        return;
      }

      if (bgMusic && isMusicEnabled) {
        cancelMusicFade();
        bgMusic.volume = volume;
      }
    });
  }

  function initQuoteCyclesSlider() {
    if (!quoteCyclesSlider || !quoteCyclesValueEl) return;

    const initialCycles = clamp(
      parseInt(quoteCyclesSlider.value || String(DEFAULT_MESSAGE_DURATION_CYCLES), 10) || DEFAULT_MESSAGE_DURATION_CYCLES,
      1,
      5
    );

    messageDurationCycles = initialCycles;
    quoteCyclesSlider.value = String(initialCycles);
    quoteCyclesValueEl.textContent = String(initialCycles);

    quoteCyclesSlider.addEventListener('input', () => {
      const cycles = clamp(parseInt(quoteCyclesSlider.value || '2', 10) || 2, 1, 5);
      messageDurationCycles = cycles;
      quoteCyclesValueEl.textContent = String(cycles);
      resetMessageFill();
    });
  }

  function initLineWidthSlider() {
    if (!lineWidthSlider || !lineWidthValueEl || !window.BreathApp) return;

    const initialWidth = clamp(
      parseInt(lineWidthSlider.value || '6', 10) || 6,
      2,
      28
    );

    lineWidthSlider.value = String(initialWidth);
    lineWidthValueEl.textContent = String(initialWidth);
    if (typeof window.BreathApp.setLineWidth === 'function') {
      window.BreathApp.setLineWidth(initialWidth);
    }

    lineWidthSlider.addEventListener('input', () => {
      const width = clamp(parseInt(lineWidthSlider.value || '6', 10) || 6, 2, 28);
      lineWidthValueEl.textContent = String(width);
      if (typeof window.BreathApp.setLineWidth === 'function') {
        window.BreathApp.setLineWidth(width);
      }
    });
  }

  function applyTheme(theme, persist) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';

    document.body.classList.toggle('theme-dark', currentTheme === 'dark');

    if (themeToggle) {
      themeToggle.checked = currentTheme === 'dark';
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        'content',
        currentTheme === 'dark' ? '#10141d' : '#ffffff'
      );
    }

    if (window.BreathApp && typeof window.BreathApp.setTheme === 'function') {
      window.BreathApp.setTheme(currentTheme);
    }

    if (persist !== false) {
      try {
        localStorage.setItem('breath_theme', currentTheme);
      } catch (_) {}
    }
  }

  // ===== Шторки (настройки и язык) =====
  function focusFirstInteractive(container) {
    if (!container) return;
    const target = container.querySelector(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    );
    if (target && typeof target.focus === 'function') {
      target.focus();
    }
  }

  function closeSettings() {
    if (
      document.activeElement &&
      settingsPanel.contains(document.activeElement) &&
      settingsToggle
    ) {
      settingsToggle.focus();
    }
    settingsPanel.classList.remove('open');
    settingsPanel.setAttribute('aria-hidden', 'true');
    settingsPanel.setAttribute('inert', '');
    if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'false');
    updateBackdropVisibility();
  }

  function openSettings() {
    closeLangPanel();
    settingsPanel.classList.add('open');
    settingsPanel.setAttribute('aria-hidden', 'false');
    settingsPanel.removeAttribute('inert');
    if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'true');
    updateBackdropVisibility();
    requestAnimationFrame(() => {
      focusFirstInteractive(settingsPanel);
    });
  }

  function toggleSettings() {
    if (settingsPanel.classList.contains('open')) {
      closeSettings();
    } else {
      openSettings();
    }
  }

  function closeLangPanel() {
    if (
      document.activeElement &&
      langPanel.contains(document.activeElement) &&
      langToggle
    ) {
      langToggle.focus();
    }
    langPanel.classList.remove('open');
    langPanel.setAttribute('aria-hidden', 'true');
    langPanel.setAttribute('inert', '');
    if (langToggle) langToggle.setAttribute('aria-expanded', 'false');
    updateBackdropVisibility();
  }

  function openLangPanel() {
    closeSettings();
    langPanel.classList.add('open');
    langPanel.setAttribute('aria-hidden', 'false');
    langPanel.removeAttribute('inert');
    if (langToggle) langToggle.setAttribute('aria-expanded', 'true');
    updateBackdropVisibility();
    requestAnimationFrame(() => {
      focusFirstInteractive(langPanel);
    });
  }

  function toggleLangPanel() {
    if (langPanel.classList.contains('open')) {
      closeLangPanel();
    } else {
      openLangPanel();
    }
  }

  function updateBackdropVisibility() {
    const anyOpen =
      settingsPanel.classList.contains('open') ||
      langPanel.classList.contains('open');

    if (anyOpen) {
      settingsBackdrop.classList.add('visible');
    } else {
      settingsBackdrop.classList.remove('visible');
    }
  }

  // ===== Список языков =====
  function renderLangList() {
    if (!langList) return;
    langList.innerHTML = '';

    SUPPORTED_LANGS.forEach(lang => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'lang-button' + (lang.code === currentLang ? ' active' : '');
      btn.dataset.lang = lang.code;
      const labelSpan = document.createElement('span');
      labelSpan.textContent = lang.label;
      const codeSpan = document.createElement('span');
      codeSpan.className = 'code';
      codeSpan.textContent = lang.code.toUpperCase();
      btn.appendChild(labelSpan);
      btn.appendChild(codeSpan);
      btn.addEventListener('click', () => {
        if (lang.code === currentLang) return;
        applyLanguage(lang.code);
        closeLangPanel();
      });
      li.appendChild(btn);
      langList.appendChild(li);
    });
  }

  function moveLangFocus(step) {
    if (!langPanel || !langPanel.classList.contains('open')) return;

    const buttons = Array.from(langPanel.querySelectorAll('.lang-button'));
    if (!buttons.length) return;

    const currentIndex = buttons.indexOf(document.activeElement);
    const fallbackIndex = Math.max(0, buttons.findIndex((btn) => btn.classList.contains('active')));
    const startIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const nextIndex = (startIndex + step + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  }

  function isTypingTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    const tag = (target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function getFocusableElements(container) {
    if (!container) return [];

    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'summary',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(container.querySelectorAll(selector)).filter((el) => {
      if (el.hasAttribute('inert')) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (el.closest('[inert]')) return false;
      if (el.closest('details:not([open])') && !el.matches('summary')) return false;
      return true;
    });
  }

  function handleTabCycleForList(e, elements) {
    if (!elements || !elements.length) return false;

    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;
    const isInside = elements.includes(active);

    if (!isInside) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return true;
    }

    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
      return true;
    }

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
      return true;
    }

    return false;
  }

  function getOpenPanel() {
    if (settingsPanel && settingsPanel.classList.contains('open')) return settingsPanel;
    if (langPanel && langPanel.classList.contains('open')) return langPanel;
    return null;
  }

  function getTopControlButtons() {
    return [langToggle, musicToggle, settingsToggle].filter(Boolean);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  function addTutorialTimer(callback, delayMs) {
    const id = window.setTimeout(callback, delayMs);
    tutorialTimers.push(id);
  }

  function clearTutorialTimers() {
    tutorialTimers.forEach((id) => {
      window.clearTimeout(id);
    });
    tutorialTimers = [];
  }

  function getTutorialStepText(stepIndex) {
    const key = TUTORIAL_STEP_KEYS[stepIndex];
    if (!key) return '';
    return uiStrings[key] || TUTORIAL_FALLBACK_TEXT[key] || '';
  }

  function setTutorialStep(stepIndex) {
    if (!tutorialHintTextEl) return;

    tutorialStepIndex = stepIndex;
    tutorialHintTextEl.innerHTML = sanitizeHtml(getTutorialStepText(stepIndex), ['br']);
  }

  function showTutorialHint() {
    if (!tutorialHintEl) return;
    tutorialHintEl.classList.add('is-visible');
    tutorialHintEl.classList.remove('is-hidden');
  }

  function hideTutorialHint() {
    if (!tutorialHintEl) return;
    tutorialHintEl.classList.remove('is-visible');
    tutorialHintEl.classList.add('is-hidden');
  }

  function syncTutorialHintLanguage() {
    if (!tutorialIsActive) return;
    if (tutorialStepIndex < 0) return;
    setTutorialStep(tutorialStepIndex);
  }

  function hasSeenFirstVisitTutorial() {
    try {
      return localStorage.getItem(FIRST_VISIT_TUTORIAL_SEEN_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function markFirstVisitTutorialAsSeen() {
    try {
      localStorage.setItem(FIRST_VISIT_TUTORIAL_SEEN_KEY, '1');
    } catch (_) {}
  }

  function startFirstVisitTutorial() {
    if (!tutorialHintEl || !tutorialHintTextEl) return;
    if (hasSeenFirstVisitTutorial()) {
      hideTutorialHint();
      return;
    }

    markFirstVisitTutorialAsSeen();
    clearTutorialTimers();
    tutorialIsActive = true;

    setTutorialStep(0);
    requestAnimationFrame(showTutorialHint);

    const firstHideAt = TUTORIAL_STEP_SHOW_MS;
    const secondShowAt = firstHideAt + TUTORIAL_STEP_GAP_MS;
    const secondHideAt = secondShowAt + TUTORIAL_STEP_SHOW_MS;
    const thirdShowAt = secondHideAt + TUTORIAL_LONG_PAUSE_MS;
    const thirdHideAt = thirdShowAt + TUTORIAL_STEP_SHOW_MS;

    addTutorialTimer(hideTutorialHint, firstHideAt);

    addTutorialTimer(() => {
      setTutorialStep(1);
      showTutorialHint();
    }, secondShowAt);

    addTutorialTimer(hideTutorialHint, secondHideAt);

    addTutorialTimer(() => {
      setTutorialStep(2);
      showTutorialHint();
    }, thirdShowAt);

    addTutorialTimer(() => {
      hideTutorialHint();
      tutorialIsActive = false;
      tutorialStepIndex = -1;
      clearTutorialTimers();
    }, thirdHideAt);
  }

  function replayFirstVisitTutorialFromSettings() {
    clearTutorialTimers();
    tutorialIsActive = false;
    tutorialStepIndex = -1;
    hideTutorialHint();

    try {
      localStorage.removeItem(FIRST_VISIT_TUTORIAL_SEEN_KEY);
    } catch (_) {}

    closeSettings();
    closeLangPanel();

    window.setTimeout(() => {
      startFirstVisitTutorial();
    }, 280);
  }

  function hasMeaningfulFocus() {
    const active = document.activeElement;
    return !!active && active !== document.body && active !== document.documentElement;
  }

  function handleTabNavigation(e) {
    if (e.key !== 'Tab') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    if (!hasKeyboardTabStarted) {
      hasKeyboardTabStarted = true;
      const openPanel = getOpenPanel();
      const topControls = getTopControlButtons();
      const active = document.activeElement;
      const activeInTopControls = topControls.includes(active);

      if (!openPanel && !activeInTopControls && langToggle) {
        e.preventDefault();
        langToggle.focus({ preventScroll: true });
        return;
      }
    }

    const openPanel = getOpenPanel();
    if (openPanel) {
      const focusables = getFocusableElements(openPanel);
      handleTabCycleForList(e, focusables);
      return;
    }

    const topControls = getTopControlButtons();
    handleTabCycleForList(e, topControls);
  }

  // ===== Ползунок скорости =====
  function initBreathingSpeedFromSlider() {
    const defaultBpm = 6;

    if (!speedSlider || !speedValueEl || !window.BreathApp) {
      if (window.BreathApp) {
        window.BreathApp.setBreathingSpeedBpm(defaultBpm);
      }
      return;
    }

    const initialBpm = parseInt(speedSlider.value || String(defaultBpm), 10);
    speedValueEl.textContent = initialBpm;
    window.BreathApp.setBreathingSpeedBpm(initialBpm);
    updateMusicPlaybackRate();

    speedSlider.addEventListener('input', () => {
      const bpm = parseInt(speedSlider.value, 10);
      speedValueEl.textContent = bpm;
      window.BreathApp.setBreathingSpeedBpm(bpm);
      updateMusicPlaybackRate();
    });
  }

  // ===== Инициализация после загрузки DOM =====
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.BreathApp) {
      console.error('BreathApp не найден. Убедись, что breath.js загружается раньше script.js');
      return;
    }

    registerServiceWorker();

    textEl = document.getElementById('breathText');

    settingsToggle = document.getElementById('settingsToggle');
    settingsPanel = document.getElementById('settingsPanel');
    settingsBackdrop = document.getElementById('settingsBackdrop');
    settingsClose = document.getElementById('settingsClose');
    tutorialHintEl = document.getElementById('tutorialHint');
    tutorialHintTextEl = document.getElementById('i18n-tutorial-hint');

    langToggle = document.getElementById('langToggle');
    musicToggle = document.getElementById('musicToggle');
    langPanel = document.getElementById('langPanel');
    langClose = document.getElementById('langClose');
    langList = document.getElementById('langList');
    bgMusic = document.getElementById('bgMusic');

    speedSlider = document.getElementById('speedSlider');
    speedValueEl = document.getElementById('speedValue');
    musicVolumeSlider = document.getElementById('musicVolumeSlider');
    musicVolumeValueEl = document.getElementById('musicVolumeValue');
    quoteCyclesSlider = document.getElementById('quoteCyclesSlider');
    quoteCyclesValueEl = document.getElementById('quoteCyclesValue');
    lineWidthSlider = document.getElementById('lineWidthSlider');
    lineWidthValueEl = document.getElementById('lineWidthValue');
    tutorialReplayButton = document.getElementById('tutorialReplayButton');
    themeToggle = document.getElementById('themeToggle');
    highContrastToggle = document.getElementById('highContrastToggle');
    largeTextToggle = document.getElementById('largeTextToggle');
    noGradientsToggle = document.getElementById('noGradientsToggle');
    bionicFontToggle = document.getElementById('bionicFontToggle');

    // Обработчики шторок
    if (settingsToggle) settingsToggle.addEventListener('click', toggleSettings);
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    if (langToggle) langToggle.addEventListener('click', toggleLangPanel);
      if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'false');
      if (langToggle) langToggle.setAttribute('aria-expanded', 'false');

    if (musicToggle) musicToggle.addEventListener('click', toggleMusic);
    if (langClose) langClose.addEventListener('click', closeLangPanel);

    if (settingsBackdrop) {
      settingsBackdrop.addEventListener('click', () => {
        closeSettings();
        closeLangPanel();
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener('change', () => {
        applyTheme(themeToggle.checked ? 'dark' : 'light', true);
      });
    }

    if (highContrastToggle) {
      highContrastToggle.addEventListener('change', () => {
        applyHighContrast(highContrastToggle.checked, true);
      });
    }

    if (largeTextToggle) {
      largeTextToggle.addEventListener('change', () => {
        applyLargeText(largeTextToggle.checked, true);
      });
    }

    if (noGradientsToggle) {
      noGradientsToggle.addEventListener('change', () => {
        applyNoGradients(noGradientsToggle.checked, true);
      });
    }

    if (bionicFontToggle) {
      bionicFontToggle.addEventListener('change', () => {
        applyBionicFont(bionicFontToggle.checked, true);
      });
    }

    if (tutorialReplayButton) {
      tutorialReplayButton.addEventListener('click', replayFirstVisitTutorialFromSettings);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSettings();
        closeLangPanel();
        return;
      }

      if (e.key === 'ArrowDown' && langPanel && langPanel.classList.contains('open')) {
        e.preventDefault();
        moveLangFocus(1);
        return;
      }

      if (e.key === 'ArrowUp' && langPanel && langPanel.classList.contains('open')) {
        e.preventDefault();
        moveLangFocus(-1);
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
    });

    window.addEventListener('keydown', handleTabNavigation, true);

    // Связь с анимацией: обновление текста по выбранному числу циклов
    window.BreathApp.onCycle(handleCycleAdvance);
    requestAnimationFrame(updateMessageFillLoop);

    // UI-часть
    renderLangList();
    initBreathingSpeedFromSlider();
    initQuoteCyclesSlider();
    initLineWidthSlider();
    initMusicVolumeSlider();
    initializeSpecialNeedsPreferences();
    applyTheme(currentTheme, false);
    applyHighContrast(isHighContrastEnabled, false);
    applyLargeText(isLargeTextEnabled, false);
    applyNoGradients(isNoGradientsEnabled, false);
    applyBionicFont(isBionicFontEnabled, false);
    setMusicEnabled(false);
    startFirstVisitTutorial();

    // Загрузка текстов
    applyLanguage(currentLang);
  });
})();
