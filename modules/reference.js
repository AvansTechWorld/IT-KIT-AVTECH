// Reference module — one fuzzy search across all knowledge bases.
// Builds an in-memory index from ports, acronyms, cable-colors, and OSI on first mount.

const FK = window.FieldKit;

let INDEX = null; // built once, cached across navigations

async function loadIndex() {
  if (INDEX) return INDEX;
  const [ports, acronyms, cables, osi] = await Promise.all([
    fetch("data/ports.json").then((r) => r.json()),
    fetch("data/acronyms.json").then((r) => r.json()),
    fetch("data/cable-colors.json").then((r) => r.json()),
    fetch("data/osi.json").then((r) => r.json()),
  ]);
  const items = [];
  ports.forEach((p) => items.push({
    type: "port", title: String(p.port), subtitle: p.name, body: `${p.proto} · ${p.desc}`,
    tags: [p.name, String(p.port), p.proto, p.desc].join(" ").toLowerCase(),
    raw: p,
  }));
  acronyms.forEach((a) => items.push({
    type: "acronym", title: a.abbr, subtitle: a.expansion, body: a.desc,
    tags: `${a.abbr} ${a.expansion} ${a.desc}`.toLowerCase(),
    raw: a,
  }));
  cables.forEach((c) => items.push({
    type: "cable", title: c.title, subtitle: `${c.pairs.length} pairs · ${c.type}`,
    body: c.notes,
    tags: (c.title + " " + c.pairs.map((p) => p.color).join(" ") + " " + c.notes).toLowerCase(),
    raw: c,
  }));
  osi.forEach((o) => items.push({
    type: "osi", title: `L${o.layer} · ${o.name}`, subtitle: o.examples, body: o.desc,
    tags: (`layer ${o.layer} ${o.name} ${o.examples} ${o.desc} ${o.dataUnit}`).toLowerCase(),
    raw: o,
  }));
  INDEX = items;
  return items;
}

// Lightweight fuzzy match: every char of query must appear in order somewhere in the text.
function fuzzyScore(query, text) {
  if (!query) return 1;
  let qi = 0, score = 0, lastMatch = -1;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      score += lastMatch === i - 1 ? 3 : 1; // bonus for consecutive
      lastMatch = i;
      qi++;
    }
  }
  return qi === query.length ? score : -1;
}

const TYPE_META = {
  port:     { label: "Port",     accent: "info"   },
  acronym:  { label: "Acronym",  accent: "accent" },
  cable:    { label: "Cable",    accent: "warn"   },
  osi:      { label: "OSI",      accent: "info"   },
};

export async function render(root) {
  root.appendChild(FK.el("div", { class: "card" }, [
    FK.el("h2", {}, ["Reference", FK.el("span", { class: "badge" }, "searchable")]),
    FK.el("p", { class: "muted" }, "Search ports, acronyms, cable colors, and the OSI model from one bar.")
  ]));

  const searchBar = FK.el("div", { class: "search-bar" });
  const input = FK.el("input", { type: "search", placeholder: "ssh, vlan, t568b, layer 3, 3389...", autocapitalize: "none", autocomplete: "off", spellcheck: "false" });
  const clearBtn = FK.el("button", { class: "clear", "aria-label": "Clear search", onclick: () => { input.value = ""; rerender(); input.focus(); } }, "×");
  searchBar.appendChild(input);
  searchBar.appendChild(clearBtn);
  root.appendChild(searchBar);

  // Type filter chips
  const chips = FK.el("div", { class: "chips" });
  const filters = { all: true, port: false, acronym: false, cable: false, osi: false };
  const chipData = [
    ["all", "All"],
    ["port", "Ports"],
    ["acronym", "Acronyms"],
    ["cable", "Cables"],
    ["osi", "OSI"],
  ];
  chipData.forEach(([k, label]) => {
    chips.appendChild(FK.el("button", {
      class: "chip" + (filters[k] ? " active" : ""),
      onclick: () => {
        for (const key in filters) filters[key] = false;
        filters[k] = true;
        chips.querySelectorAll(".chip").forEach((c, i) => c.classList.toggle("active", chipData[i][0] === k));
        rerender();
      }
    }, label));
  });
  root.appendChild(chips);

  const list = FK.el("ul", { class: "list" });
  root.appendChild(list);

  // Loading placeholder while index fetches.
  list.appendChild(FK.el("li", { class: "empty" }, "Loading reference…"));

  let items;
  try { items = await loadIndex(); }
  catch (e) { list.innerHTML = ""; list.appendChild(FK.el("li", { class: "empty" }, "Failed to load datasets. Check connection.")); return; }

  // Filter state — start by showing everything (capped to 50 to keep page light)
  function rerender() {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = "";
    let filtered = items;
    const activeType = Object.keys(filters).find((k) => filters[k] && k !== "all");
    if (activeType) filtered = filtered.filter((it) => it.type === activeType);
    let scored;
    if (q) {
      scored = filtered
        .map((it) => ({ it, s: fuzzyScore(q, it.tags) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s);
    } else {
      scored = filtered.map((it) => ({ it, s: 0 }));
    }
    const cap = q ? 60 : 50;
    scored.slice(0, cap).forEach(({ it }) => list.appendChild(renderItem(it, q)));
    if (scored.length === 0) list.appendChild(FK.el("li", { class: "empty" }, "No matches."));
    else if (scored.length > cap) list.appendChild(FK.el("li", { class: "empty" }, `… ${scored.length - cap} more — refine your search.`));
  }

  input.addEventListener("input", FK.debounce(rerender, 60));
  rerender();
  input.focus();
}

function renderItem(it, query) {
  const meta = TYPE_META[it.type];
  const li = FK.el("li", { class: "list-item" });
  li.appendChild(FK.el("div", { class: "list-item-head" }, [
    FK.el("span", { class: "list-item-title" }, highlight(it.title, query)),
    FK.el("span", { class: "list-item-meta" }, meta.label)
  ]));
  if (it.subtitle) li.appendChild(FK.el("div", { class: "list-item-body" }, highlight(it.subtitle, query)));
  if (it.body) li.appendChild(FK.el("div", { class: "list-item-body", style: "margin-top:2px;color:var(--text-muted);" }, highlight(it.body, query)));

  // Type-specific extra detail
  if (it.type === "port") {
    li.appendChild(FK.el("div", { class: "list-item-body", style: "margin-top:4px;font-family:var(--mono);color:var(--accent);" },
      `TCP/UDP: ${it.raw.proto}`));
  } else if (it.type === "cable") {
    const pairList = FK.el("div", { style: "margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-family:var(--mono);font-size:12px;" });
    it.raw.pairs.forEach((p) => {
      pairList.appendChild(FK.el("div", {}, [FK.el("span", { style: "color:var(--text-dim);" }, `Pin ${p.pin}: `), p.color]));
    });
    li.appendChild(pairList);
  } else if (it.type === "osi") {
    li.appendChild(FK.el("div", { class: "list-item-body", style: "margin-top:4px;font-family:var(--mono);" },
      `PDU: ${it.raw.dataUnit}`));
  }
  return li;
}

function highlight(text, q) {
  if (!q) return text;
  // Escape and wrap matched runs (only matches first occurrence run for simplicity)
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  const span = FK.el("span", {});
  span.appendChild(document.createTextNode(before));
  const m = FK.el("mark", { style: "background:rgba(61,214,140,0.25);color:inherit;border-radius:2px;" }, match);
  span.appendChild(m);
  span.appendChild(document.createTextNode(after));
  return span;
}
