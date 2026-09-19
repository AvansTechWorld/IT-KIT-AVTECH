# IT Field Kit

One installable PWA, five modular tabs, fully offline. Built as a single cohesive field tool — not a bundle of toy calculators.

## Modules

| Tab | What it does |
|---|---|
| **Calc** | Subnet/CIDR, Voltage drop (AWG + length + phase), Ohm's law, Password entropy + crack-time, SLA/uptime, ROI/TCO — one shared input→live-result UI, swap the formula per tool. |
| **Ref** | One fuzzy search bar across ports, acronyms, T568A/B cable color codes, and the OSI model. Filter by type. |
| **Convert** | Base64 / hex / binary / URL / ASCII-codes encode+decode, plus unit conversions (data, length, speed, temp, time). |
| **Learn** | Flashcards + multiple-choice quizzes built from the same JSON datasets as Ref — no duplicate content. |
| **Log** | On-site work log (client, issue, resolution, timestamp) saved to IndexedDB. Export CSV or print-to-PDF. |

## Why this design

- **Shared data layer** — `data/ports.json`, `data/acronyms.json`, `data/cable-colors.json`, `data/osi.json` are each consumed by both Ref and Learn. Edit one JSON, both features update.
- **Shared UI shell** — one manifest, one service worker, one install prompt. Bottom nav routes between modules; modules lazy-load as ES modules.
- **Offline-first SW** — `service-worker.js` precaches the shell on install; data JSON is network-first with cache fallback; the whole app keeps working with no signal. Bump `CACHE_VERSION` on each deploy to silently update.
- **IndexedDB for the log** — survives app closes, device reboots, and offline use. CSV export gives you billing-defensible records; print-to-PDF gives you a one-tap paper backup.

## Project layout

```
it-field-kit/
├── index.html              # Shell + bottom nav
├── styles.css              # Mobile-first dark theme
├── app.js                  # Router, SW registration, install prompt
├── manifest.json           # PWA manifest (scope, icons, theme)
├── service-worker.js       # Cache versioning, offline-first
├── icons/
│   ├── icon.svg            # Source vector icon
│   ├── icon-192.png
│   └── icon-512.png
├── data/
│   ├── ports.json          # ~70 IANA ports
│   ├── acronyms.json       # ~120 IT/networking acronyms
│   ├── cable-colors.json   # T568A/B, crossover, USOC, 25-pair
│   ├── osi.json            # 7-layer model
│   └── quiz.json           # Quiz/flashcard deck definitions
└── modules/
    ├── calculators.js      # Six calc tools
    ├── reference.js        # Fuzzy-search across all datasets
    ├── converter.js        # Encoding + unit conversion
    ├── learn.js            # Flashcards + quizzes (reuses data/)
    └── notes.js            # IndexedDB work log + CSV/PDF export
```

## Run locally

It's static — any HTTP server works. Pick one:

```bash
# Python (built into most systems)
python3 -m http.server 8000

# Node
npx serve .

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000/`. (You need an HTTP server because service workers and ES module imports don't work from `file://`.)

## Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `it-field-kit`).
2. Copy every file from this folder into the repo root.
3. Push to `main`.
4. In GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / root**.
5. Wait ~1 minute. Your PWA is live at `https://<your-username>.github.io/it-field-kit/`.
6. Open the URL on your phone, tap the browser menu → **Add to Home Screen**. It installs as a standalone app.

> **Subpath note:** all paths in `manifest.json` and `service-worker.js` are relative (`./`) so the app works under any subpath without configuration.

## Updating content

- Add a port → append to `data/ports.json`. Ref search and Learn quizzes pick it up automatically.
- Add an acronym → append to `data/acronyms.json`. Same — Ref and Learn both see it.
- Add a calculator → add a function to `modules/calculators.js`, register it in the `TOOLS` array at the top.
- Ship a code update → bump `CACHE_VERSION` in `service-worker.js` so clients pick up the new shell on next visit.

## Browser support

- Installable on Chrome / Edge / Safari (iOS 16.4+ supports web push and standalone mode via manifest).
- Service worker requires HTTPS or localhost — GitHub Pages serves HTTPS by default.
- IndexedDB for the log; `btoa`/`atob` for Base64; ES module dynamic imports for lazy loading. All baseline 2022+ browser features.

## License

MIT — use it, fork it, put it on your resume.
