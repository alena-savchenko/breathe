# Breathe

Breathe is a simple breathing guide that runs in your browser. It’s made for moments of acute anxiety or a panic attack, when installing an app, creating an account, or figuring out settings can feel impossible.

Open the link and start right away. The page shows a clear breathing rhythm with no distractions, so you can follow along without thinking. It works on any modern phone or computer and can be saved as a “safety link” in bookmarks, notes, or a pinned chat to share with someone who needs it.

The goal is straightforward: remove friction and offer quick, calm structure when things feel out of control. It’s not a medical tool and doesn’t replace professional help—just a fast, accessible support for the moment.

## Project Structure

```text
.
├─ index.html
├─ assets/
│  ├─ css/
│  │  └─ styles.css
│  └─ js/
│     ├─ breath.js
│     └─ script.js
├─ i18n/
│  ├─ en/
│  │  ├─ messages.txt
│  │  └─ ui.txt
│  ├─ ru/
│  │  ├─ messages.txt
│  │  └─ ui.txt
│  ├─ uk/
│  │  ├─ messages.txt
│  │  └─ ui.txt
│  └─ de/
│     ├─ messages.txt
│     └─ ui.txt
├─ .gitattributes
├─ .gitignore
└─ README.md
```

## Technical Notes

- **Zero-build static app**: no framework, no bundler, no backend required.
- **Canvas-based breathing animation** in `assets/js/breath.js` with configurable breathing speed (BPM).
- **UI and i18n logic** in `assets/js/script.js`:
  - language switching with persistence via `localStorage`
  - async loading of localized content from `i18n/<lang>/...`
  - race-safe language loading (latest selection wins)
- **Localization files**:
  - `messages.txt` for rotating breathing prompts
  - `ui.txt` for interface labels and descriptions
- **Accessible controls**:
  - language and settings panels
  - localized `aria-label` values for key controls
- **Privacy-first by design**:
  - no accounts, no trackers, no cookies required by app logic.

## Run Locally

Because translations are loaded with `fetch`, run through a local server (not `file://`).

Examples:

```bash
# Python 3
python -m http.server 8080

# Node (if installed)
npx serve .
```

Then open:

- `http://localhost:8080` (Python)
- URL printed by `serve`

## Browser Support

Works in current versions of major modern browsers on desktop and mobile (Chrome, Edge, Firefox, Safari).

## Disclaimer

This project is a supportive self-help tool and not a medical service. In case of severe or recurring symptoms, contact a qualified healthcare professional or local emergency services.
