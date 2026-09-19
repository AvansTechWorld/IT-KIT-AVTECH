/* IT Field Kit — service worker
 * Strategy: cache-first for the shell, network-first for data JSON, stale-while-revalidate fallback.
 * Bump CACHE_VERSION on every deploy that ships code changes — the old cache gets wiped on activate.
 */
const CACHE_VERSION = "v1.0.0";
const SHELL_CACHE = `fieldkit-shell-${CACHE_VERSION}`;
const DATA_CACHE = `fieldkit-data-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/ports.json",
  "./data/acronyms.json",
  "./data/cable-colors.json",
  "./data/osi.json",
  "./data/quiz.json",
  "./modules/calculators.js",
  "./modules/reference.js",
  "./modules/converter.js",
  "./modules/learn.js",
  "./modules/notes.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Data JSON: network-first, fall back to cache (so updates to the dataset propagate, but offline still works).
  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Shell: cache-first, then network, then offline fallback page.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
