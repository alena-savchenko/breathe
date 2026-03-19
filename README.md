# Breath slow

Breath slow is a lightweight browser breathing companion for panic, stress, and overwhelm.
Open and use immediately: no install, no account, no backend.

**Live:** [https://alena-savchenko.github.io/breathe/](https://alena-savchenko.github.io/breathe/)

> Supportive self-help tool, not a medical service.

## Preview

<p align="center">
	<img src=".github/assets/demo_light.png" alt="Breath slow — light theme" width="48%" />
	<img src=".github/assets/demo_dark.png" alt="Breath slow — dark theme" width="48%" />
</p>

## Features

- Guided breathing animation with adjustable speed (BPM)
- Interactive violet line (mouse / touch)
- Quotes synced to breathing cycles
- Optional background music with volume and BPM-linked playback
- First-visit tutorial + replay from Settings
- Languages: English, Русский, Українська, Deutsch
- Keyboard-friendly navigation

## Settings

- Breathing speed, quote cadence, line thickness
- Music toggle and volume
- Theme (light/dark)
- Language switcher
- Tutorial replay

Settings are stored locally in `localStorage`.

## Special needs (Accessibility)

For calmer visuals and easier reading, the app includes a dedicated Special needs section:

- High contrast
- Large text
- Disable gradients
- Bionic font

You can combine all options or enable only the ones you need.

<p align="center">
	<img src=".github/assets/demo_special_needs.png" alt="Breath slow — special needs settings" width="78%" />
</p>

## Run locally

```bash
# Python 3
python -m http.server 8080

# Node
npx serve .
```

Open: `http://localhost:8080`

## Project layout

```text
.
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  ├─ js/
│  │  ├─ breath.js
│  │  └─ script.js
│  ├─ preview/OG-preview.png
│  ├─ fonts/fast-font/*
│  └─ audio/music/*
├─ i18n/
│  ├─ en/{messages.txt,ui.txt}
│  ├─ ru/{messages.txt,ui.txt}
│  ├─ uk/{messages.txt,ui.txt}
│  └─ de/{messages.txt,ui.txt}
└─ .github/assets/
	├─ demo_light.png
	├─ demo_dark.png
	└─ demo_special_needs.png
```

## Docs

- Credits and licenses: `CREDITS.md`
- Audio sources: `assets/audio/music/SOURCES.md`
- Font sources: `assets/fonts/fast-font/SOURCES.md`
