# Breathe

A minimal breathing guide that runs in your browser — made for moments of acute anxiety or a panic attack, when installing an app, signing up, or dealing with settings can feel impossible.

**Live:** [https://alena-savchenko.github.io/breathe/](https://alena-savchenko.github.io/breathe/)


Open the link and start right away. The page shows a clear breathing rhythm with no distractions, so you can follow along without thinking.

This is a supportive self-help tool, not a medical service. If your symptoms are severe or recurring, please reach out to a qualified healthcare professional or local emergency services.

## What it does

* Guided breathing animation with adjustable speed
* Short prompts/quotes synced to breathing (adjustable frequency)
* Light/dark theme
* Optional background music (playback speed follows breathing BPM)
* 4 languages: Russian, Ukrainian, English, German
* Mobile-friendly controls and gestures (including pinch)

## Features

* Zero-build static app: no framework, no bundler, no backend
* Canvas-based breathing engine (`assets/js/breath.js`)
* UI, settings, and i18n logic (`assets/js/script.js`)
* Localization via `i18n/<lang>/messages.txt` and `i18n/<lang>/ui.txt`
* Privacy-first by design: no accounts, no trackers, no cookies required by app logic
* Basic accessibility: localized `aria-label` values for key controls

<details>
<summary>Project structure</summary>

```text
.
├─ robots.txt
├─ favicon.ico
├─ icon.svg
├─ favicon-32x32.png
├─ apple-touch-icon.png
├─ android-chrome-192x192.png
├─ index.html
├─ assets/
│  ├─ audio/
│  │  └─ music/
│  │     ├─ ambient-loop-120s-fade_64k.opus
│  │     ├─ ambient-loop-120s-fade_128k.mp3
│  │     ├─ ambient-meditation_quietphase_pixabay_485723.mp3
│  │     ├─ SOURCES.md
│  │     └─ Content License Summary - Pixabay.pdf
│  ├─ css/
│  │  └─ styles.css
│  └─ js/
│     ├─ breath.js
│     └─ script.js
├─ i18n/
│  ├─ en/ (messages.txt, ui.txt)
│  ├─ ru/ (messages.txt, ui.txt)
│  ├─ uk/ (messages.txt, ui.txt)
│  └─ de/ (messages.txt, ui.txt)
├─ .gitattributes
├─ .gitignore
├─ LICENSE
└─ README.md
```

</details>

## Running locally (optional)

For some browsers, opening `index.html` directly (via `file://`) may work.
If translations don’t load or anything behaves strangely, run a local server instead:

**VS Code:** install the “Live Server” extension and use **Open with Live Server**.

```bash
# Python 3
python -m http.server 8080

# Node (if installed)
npx serve .
```

Then open `http://localhost:8080`.

## Roadmap

* Preset breathing patterns (e.g., box breathing, 4-7-8)
* Offline-friendly PWA mode

## Attribution

Audio sources and licenses are listed in `assets/audio/music/SOURCES.md`.

## Feedback

Suggestions are welcome. You can open a GitHub issue — or email me if that’s easier.
