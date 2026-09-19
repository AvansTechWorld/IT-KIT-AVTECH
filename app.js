// IT Field Kit — app shell
// Router: hash-based, lazy-loads module scripts, renders into #view.
// Modules expose { title, render(root) } and get re-rendered on navigation.

const ROUTES = {
  calculators: () => import("./modules/calculators.js"),
  reference:   () => import("./modules/reference.js"),
  converter:   () => import("./modules/converter.js"),
  learn:       () => import("./modules/learn.js"),
  notes:       () => import("./modules/notes.js"),
};

const ROUTE_TITLES = {
  calculators: "Calculators",
  reference: "Reference",
  converter: "Converter",
  learn: "Learn",
  notes: "Notes & Log",
};

const view = document.getElementById("view");
const sub = document.getElementById("view-sub");
const navButtons = document.querySelectorAll(".nav-btn");

// Shared utilities exposed on window.FieldKit for modules to use.
window.FieldKit = {
  toast(msg, ms = 1800) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove("show"), ms);
  },
  el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "dataset") Object.assign(node.dataset, v);
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  },
  // Debounce helper for live-calculator inputs.
  debounce(fn, ms = 80) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },
  // Persist + restore the last active tab across sessions.
  saveRoute(r) { try { localStorage.setItem("fk-route", r); } catch {} },
  loadRoute() { try { return localStorage.getItem("fk-route") || "calculators"; } catch { return "calculators"; } },
};

let currentCleanup = null;

async function navigate(route) {
  if (!ROUTES[route]) route = "calculators";
  if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }
  view.innerHTML = "";

  navButtons.forEach((b) => b.classList.toggle("active", b.dataset.route === route));
  sub.textContent = ROUTE_TITLES[route];
  window.FieldKit.saveRoute(route);
  location.hash = route;

  try {
    const mod = await ROUTES[route]();
    if (typeof mod.mount === "function") currentCleanup = mod.mount(view) || null;
    else if (typeof mod.render === "function") mod.render(view);
    view.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty">Module failed to load: ${err.message}</div>`;
  }
}

navButtons.forEach((b) => b.addEventListener("click", () => navigate(b.dataset.route)));

window.addEventListener("hashchange", () => {
  const r = location.hash.slice(1);
  if (r && ROUTES[r]) navigate(r);
});

// Initial route: hash > saved > default
const initial = location.hash.slice(1) || window.FieldKit.loadRoute();
navigate(initial);

// Service worker registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}

// PWA install prompt
let deferredPrompt = null;
const installBtn = document.getElementById("install-btn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") window.FieldKit.toast("Installed — find it on your home screen");
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});
window.addEventListener("appinstalled", () => installBtn.classList.add("hidden"));
