// script.js
(function () {
  const DEFAULT_LANG = 'ru';

  const SUPPORTED_LANGS = [
    { code: 'ru', label: 'Русский' },
    { code: 'uk', label: 'Українська' },
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' }
  ];

  function getInitialLang() {
    try {
      const stored = localStorage.getItem('breath_lang');
      const codes = SUPPORTED_LANGS.map(l => l.code);
      if (stored && codes.includes(stored)) return stored;
    } catch (_) {}
    return DEFAULT_LANG;
  }

  let currentLang = getInitialLang();

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

  // DOM-элементы
  let textEl;
  let settingsToggle, settingsPanel, settingsBackdrop, settingsClose;
  let langToggle, langPanel, langClose, langList;
  let speedSlider, speedValueEl;

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
    textEl.style.opacity = 0;
    setTimeout(() => {
      textEl.innerHTML = sanitizeHtml(newHtml, ['br']);
      textEl.style.opacity = 1;
    }, 600);
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
      cyclesSinceChange >= 3
    ) {
      currentMessageIndex += 1;
      cyclesSinceChange = 0;
      setTextWithFade(messages[currentMessageIndex]);
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

    setHtml('i18n-settings-title', 'settings.title');
    setHtml('i18n-settings-breathingSpeed-title', 'settings.breathingSpeed.title');

    setHtml('i18n-settings-breathsPerMinute-label', 'settings.breathsPerMinute.label');
    setHtml('i18n-settings-breathsPerMinute-hint', 'settings.breathsPerMinute.hint', ['br']);

    setHtml('i18n-description-title', 'description.title');
    setHtml('i18n-description-body', 'description.body', ['br']);

    setAriaLabel('langToggle', 'buttons.langToggle.ariaLabel');
    setAriaLabel('settingsToggle', 'buttons.settingsToggle.ariaLabel');
  }

  // ===== Шторки (настройки и язык) =====
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
    updateBackdropVisibility();
  }

  function openSettings() {
    closeLangPanel();
    settingsPanel.classList.add('open');
    settingsPanel.setAttribute('aria-hidden', 'false');
    updateBackdropVisibility();
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
    updateBackdropVisibility();
  }

  function openLangPanel() {
    closeSettings();
    langPanel.classList.add('open');
    langPanel.setAttribute('aria-hidden', 'false');
    updateBackdropVisibility();
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

    speedSlider.addEventListener('input', () => {
      const bpm = parseInt(speedSlider.value, 10);
      speedValueEl.textContent = bpm;
      window.BreathApp.setBreathingSpeedBpm(bpm);
    });
  }

  // ===== Инициализация после загрузки DOM =====
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.BreathApp) {
      console.error('BreathApp не найден. Убедись, что breath.js загружается раньше script.js');
      return;
    }

    textEl = document.getElementById('breathText');

    settingsToggle = document.getElementById('settingsToggle');
    settingsPanel = document.getElementById('settingsPanel');
    settingsBackdrop = document.getElementById('settingsBackdrop');
    settingsClose = document.getElementById('settingsClose');

    langToggle = document.getElementById('langToggle');
    langPanel = document.getElementById('langPanel');
    langClose = document.getElementById('langClose');
    langList = document.getElementById('langList');

    speedSlider = document.getElementById('speedSlider');
    speedValueEl = document.getElementById('speedValue');

    // Обработчики шторок
    if (settingsToggle) settingsToggle.addEventListener('click', toggleSettings);
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    if (langToggle) langToggle.addEventListener('click', toggleLangPanel);
    if (langClose) langClose.addEventListener('click', closeLangPanel);

    if (settingsBackdrop) {
      settingsBackdrop.addEventListener('click', () => {
        closeSettings();
        closeLangPanel();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSettings();
        closeLangPanel();
      }
    });

    // Связь с анимацией: обновление текста каждые 3 цикла
    window.BreathApp.onCycle(handleCycleAdvance);

    // UI-часть
    renderLangList();
    initBreathingSpeedFromSlider();

    // Загрузка текстов
    applyLanguage(currentLang);
  });
})();
