// Notes / Log module — on-site work log persisted to IndexedDB.
// Fields: id, time, client, issue, resolution. Export to CSV or printable PDF (window.print).

const FK = window.FieldKit;
const DB_NAME = "fieldkit";
const STORE = "notes";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("time", "time");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAdd(note) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(note);
    tx.oncomplete = () => resolve(note);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbPut(note) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(note);
    tx.oncomplete = () => resolve(note);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.time - a.time));
    req.onerror = () => reject(req.error);
  });
}

export async function render(root) {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Add Entry", FK.el("span", { class: "badge" }, "work log")]));
  const clientIn = FK.el("input", { type: "text", placeholder: "Client / site name", autocapitalize: "words" });
  const issueIn = FK.el("textarea", { placeholder: "Issue / work performed", autocapitalize: "sentences" });
  issueIn.style.minHeight = "60px";
  const resolutionIn = FK.el("textarea", { placeholder: "Resolution / outcome", autocapitalize: "sentences" });
  resolutionIn.style.minHeight = "60px";
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Client / site"), clientIn]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Issue"), issueIn]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Resolution"), resolutionIn]));

  const actions = FK.el("div", { class: "btn-row" });
  const saveBtn = FK.el("button", { class: "btn primary", onclick: save }, "Save entry");
  const clearBtn = FK.el("button", { class: "btn", onclick: () => {
    clientIn.value = ""; issueIn.value = ""; resolutionIn.value = "";
    editingId = null; saveBtn.textContent = "Save entry";
  }}, "Clear form");
  actions.appendChild(saveBtn);
  actions.appendChild(clearBtn);
  card.appendChild(actions);
  root.appendChild(card);

  // List header
  const listCard = FK.el("section", { class: "card" });
  listCard.appendChild(FK.el("h2", {}, ["History", FK.el("span", { class: "badge", id: "note-count" }, "0")]));
  const exportRow = FK.el("div", { class: "btn-row", style: "margin-bottom:10px;" });
  const csvBtn = FK.el("button", { class: "btn", onclick: exportCSV }, "Export CSV");
  const pdfBtn = FK.el("button", { class: "btn", onclick: exportPDF }, "Print / Save as PDF");
  const clearAllBtn = FK.el("button", { class: "btn danger", onclick: clearAll }, "Delete all");
  exportRow.appendChild(csvBtn);
  exportRow.appendChild(pdfBtn);
  exportRow.appendChild(clearAllBtn);
  listCard.appendChild(exportRow);

  const list = FK.el("div", { id: "note-list" });
  listCard.appendChild(list);
  root.appendChild(listCard);

  let editingId = null;

  async function refresh() {
    const notes = await dbAll();
    document.getElementById("note-count").textContent = String(notes.length);
    list.innerHTML = "";
    if (notes.length === 0) {
      list.appendChild(FK.el("div", { class: "empty" }, "No entries yet — fill the form above and tap Save."));
      return;
    }
    notes.forEach((n) => list.appendChild(renderItem(n)));
  }

  function renderItem(n) {
    const wrap = FK.el("div", { class: "note-item" });
    wrap.appendChild(FK.el("div", { class: "note-item-head" }, [
      FK.el("span", { class: "note-client" }, n.client || "(no client)"),
      FK.el("span", { class: "note-time" }, new Date(n.time).toLocaleString())
    ]));
    if (n.issue) wrap.appendChild(FK.el("div", { class: "note-issue" }, [FK.el("strong", {}, "Issue: "), n.issue]));
    if (n.resolution) wrap.appendChild(FK.el("div", { class: "note-resolution" }, [FK.el("strong", {}, "Resolution: "), n.resolution]));
    const actions = FK.el("div", { class: "note-actions" });
    actions.appendChild(FK.el("button", { class: "btn", onclick: () => edit(n) }, "Edit"));
    actions.appendChild(FK.el("button", { class: "btn danger", onclick: () => del(n) }, "Delete"));
    wrap.appendChild(actions);
    return wrap;
  }

  function edit(n) {
    editingId = n.id;
    clientIn.value = n.client || "";
    issueIn.value = n.issue || "";
    resolutionIn.value = n.resolution || "";
    saveBtn.textContent = "Update entry";
    clientIn.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(n) {
    if (!confirm(`Delete entry for ${n.client || "this item"}?`)) return;
    await dbDelete(n.id);
    FK.toast("Deleted");
    refresh();
  }

  async function save() {
    const client = clientIn.value.trim();
    const issue = issueIn.value.trim();
    const resolution = resolutionIn.value.trim();
    if (!client && !issue && !resolution) { FK.toast("Nothing to save"); return; }
    const note = {
      id: editingId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      time: editingId ? (await getTimeOf(editingId)) || Date.now() : Date.now(),
      client, issue, resolution
    };
    await dbPut(note);
    FK.toast(editingId ? "Updated" : "Saved");
    editingId = null;
    saveBtn.textContent = "Save entry";
    clientIn.value = ""; issueIn.value = ""; resolutionIn.value = "";
    refresh();
  }

  async function getTimeOf(id) {
    const all = await dbAll();
    const found = all.find((n) => n.id === id);
    return found ? found.time : null;
  }

  async function exportCSV() {
    const notes = await dbAll();
    if (notes.length === 0) { FK.toast("No entries to export"); return; }
    const esc = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
    const rows = [["Time", "Client", "Issue", "Resolution"]].concat(
      notes.map((n) => [
        new Date(n.time).toISOString(),
        n.client || "",
        n.issue || "",
        n.resolution || ""
      ].map(esc))
    );
    const csv = rows.map((r) => r.join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = FK.el("a", { href: url, download: `fieldkit-log-${new Date().toISOString().slice(0,10)}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    FK.toast(`Exported ${notes.length} entries`);
  }

  async function exportPDF() {
    const notes = await dbAll();
    if (notes.length === 0) { FK.toast("No entries to export"); return; }
    const w = window.open("", "_blank");
    if (!w) { FK.toast("Allow pop-ups to export PDF"); return; }
    const rows = notes.map((n) => `
      <tr>
        <td>${new Date(n.time).toLocaleString()}</td>
        <td>${escapeHtml(n.client || "")}</td>
        <td>${escapeHtml(n.issue || "")}</td>
        <td>${escapeHtml(n.resolution || "")}</td>
      </tr>`).join("");
    w.document.write(`<!doctype html><html><head><title>Field Kit Work Log</title>
      <style>
        body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; }
        td:first-child { white-space: nowrap; font-family: monospace; font-size: 11px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>IT Field Kit — Work Log</h1>
      <div class="meta">Generated ${new Date().toLocaleString()} · ${notes.length} entries</div>
      <table><thead><tr><th>Time</th><th>Client / Site</th><th>Issue</th><th>Resolution</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>setTimeout(() => window.print(), 200);</script>
      </body></html>`);
    w.document.close();
  }

  async function clearAll() {
    const notes = await dbAll();
    if (notes.length === 0) return;
    if (!confirm(`Delete all ${notes.length} entries? This cannot be undone.`)) return;
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    FK.toast("All entries deleted");
    refresh();
  }

  refresh();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
