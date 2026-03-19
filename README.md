# Breath slow

A minimal breathing guide that runs in your browser — made for moments of acute anxiety or a panic attack, when installing an app, signing up, or dealing with settings can feel impossible.

**Live (primary):** [https://breathe-slow.app/](https://breathe-slow.app/)
**Live (GitHub Pages):** [https://alena-savchenko.github.io/breathe/](https://alena-savchenko.github.io/breathe/)


Open the link and start right away. The page shows a clear breathing rhythm with no distractions, so you can follow along without thinking.

This is a supportive self-help tool, not a medical service. If your symptoms are severe or recurring, please reach out to a qualified healthcare professional or local emergency services.

## What it does

* Guided breathing animation with adjustable speed
* Short prompts/quotes synced to breathing (adjustable frequency)
* Light/dark theme
* Optional background music (playback speed follows breathing BPM)
* “Special needs” settings: high contrast, large text, no gradients, bionic font
* 4 languages: Russian, Ukrainian, English, German
* Mobile-friendly controls and gestures (including pinch)

## Special Needs (Accessibility)

The app includes a dedicated **Special needs** block in Settings for people who may need calmer visuals, stronger readability, or more stable text presentation.

Why this matters:

* During anxiety/panic, cognitive load and visual sensitivity can increase.
* For ADHD, dyslexia, low vision, migraine sensitivity, or stress-related attention difficulties, small UI choices can meaningfully affect usability.
* Accessibility options help users adapt the interface to their own perception instead of forcing one default style.

Included options:

* **High contrast mode** — increases contrast of text and controls for better readability.
* **Large text** — enlarges key UI text while preserving layout integrity on desktop and mobile.
* **Disable gradients** — removes animated/fill gradient effects (quotes switch plainly, canvas lines are solid-color).
* **Bionic font** — applies a reading-supportive font to all on-page text (quotes, settings, description).

All of these options are local and persistent in browser storage, so users do not need to reconfigure on each visit.

### What is a bionic font?

In simple terms, a bionic-style font is designed to make scanning text easier by emphasizing letter shapes and improving visual anchoring while reading. Some people with ADHD, dyslexia, or general reading fatigue report that this lowers effort and helps maintain reading flow.

Important note: this is a support feature, not a universal solution. It may help some users and feel neutral (or even uncomfortable) for others, so the toggle is optional.

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

### Release Note (localStorage)

When you ship breaking UI/state changes, update `STORAGE_SCHEMA_VERSION` in `assets/js/script.js`.
Use full ISO datetime format, for example: `2026-02-27T00:00:00Z`.
