// Converter module — text-in / text-out for encodings + unit conversions.

const FK = window.FieldKit;

const TEXT_MODES = [
  { id: "base64-enc",  label: "Base64 Encode" },
  { id: "base64-dec",  label: "Base64 Decode" },
  { id: "hex-enc",     label: "Hex Encode (ASCII)" },
  { id: "hex-dec",     label: "Hex Decode (ASCII)" },
  { id: "bin-enc",     label: "Binary Encode (8-bit)" },
  { id: "bin-dec",     label: "Binary Decode (8-bit)" },
  { id: "url-enc",     label: "URL Encode" },
  { id: "url-dec",     label: "URL Decode" },
  { id: "ascii-codes", label: "ASCII → Char Codes" },
  { id: "reverse",     label: "Reverse Text" },
  { id: "uppercase",   label: "UPPERCASE" },
  { id: "lowercase",   label: "lowercase" },
];

const UNIT_CATEGORIES = [
  {
    id: "data", label: "Data size", base: "byte",
    units: [
      ["bit", 1/8], ["byte", 1], ["KB", 1024], ["MB", 1024**2],
      ["GB", 1024**3], ["TB", 1024**4], ["PB", 1024**5]
    ]
  },
  {
    id: "length", label: "Length", base: "m",
    units: [["mm", 0.001], ["cm", 0.01], ["m", 1], ["km", 1000], ["in", 0.0254], ["ft", 0.3048], ["yd", 0.9144], ["mi", 1609.344]]
  },
  {
    id: "speed", label: "Speed", base: "m/s",
    units: [["m/s", 1], ["km/h", 0.277778], ["mph", 0.44704], ["ft/s", 0.3048], ["knot", 0.514444]]
  },
  {
    id: "temp", label: "Temperature", base: "C", units: [["C", "C"], ["F", "F"], ["K", "K"]]
  },
  {
    id: "time", label: "Time", base: "sec",
    units: [["ms", 0.001], ["sec", 1], ["min", 60], ["hour", 3600], ["day", 86400], ["week", 604800], ["year", 31557600]]
  },
];

export function render(root) {
  const wrap = FK.el("div");
  const chips = FK.el("div", { class: "chips" });
  let mode = "text";
  const tabs = [["text", "Text/Encoding"], ["unit", "Unit"]];
  tabs.forEach(([id, label]) => {
    chips.appendChild(FK.el("button", {
      class: "chip" + (id === mode ? " active" : ""),
      onclick: () => {
        mode = id;
        chips.querySelectorAll(".chip").forEach((c, i) => c.classList.toggle("active", tabs[i][0] === id));
        host.innerHTML = "";
        host.appendChild(mode === "text" ? textPanel() : unitPanel());
      }
    }, label));
  });
  wrap.appendChild(chips);
  const host = FK.el("div");
  host.appendChild(textPanel());
  wrap.appendChild(host);
  root.appendChild(wrap);
}

// ---------- Text / Encoding panel ----------
function textPanel() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Text & Encoding", FK.el("span", { class: "badge" }, "convert")]));
  const sel = FK.el("select", {}, TEXT_MODES.map((m) => FK.el("option", { value: m.id }, m.label)));
  sel.value = "base64-enc";
  const input = FK.el("textarea", { placeholder: "Paste input text here...", spellcheck: "false", autocapitalize: "none" });
  const output = FK.el("textarea", { readonly: "true", placeholder: "Output appears here", spellcheck: "false" });
  output.style.minHeight = "100px";
  const btnRow = FK.el("div", { class: "btn-row", style: "margin-top:10px;" });
  const copyBtn = FK.el("button", { class: "btn primary", onclick: async () => {
    if (!output.value) return;
    try { await navigator.clipboard.writeText(output.value); FK.toast("Copied"); }
    catch { output.select(); document.execCommand("copy"); FK.toast("Copied"); }
  }}, "Copy result");
  const swapBtn = FK.el("button", { class: "btn", onclick: () => {
    input.value = output.value;
    compute();
  }}, "↑ Use as input");
  btnRow.appendChild(copyBtn);
  btnRow.appendChild(swapBtn);

  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Mode"), sel]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Input"), input]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Output"), output]));
  card.appendChild(btnRow);

  function compute() {
    const v = input.value;
    try {
      output.value = convertText(sel.value, v);
      output.classList.remove("warn");
    } catch (e) {
      output.value = "Error: " + e.message;
      output.classList.add("warn");
    }
  }
  sel.addEventListener("change", compute);
  input.addEventListener("input", FK.debounce(compute, 80));
  compute();
  return card;
}

function convertText(mode, v) {
  switch (mode) {
    case "base64-enc":
      // Handle UTF-8 properly
      return btoa(unescape(encodeURIComponent(v)));
    case "base64-dec":
      return decodeURIComponent(escape(atob(v.trim())));
    case "hex-enc":
      return Array.from(unescape(encodeURIComponent(v))).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
    case "hex-dec": {
      const clean = v.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "");
      if (clean.length % 2) throw new Error("odd-length hex");
      let out = "";
      for (let i = 0; i < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
      return decodeURIComponent(escape(out));
    }
    case "bin-enc":
      return Array.from(unescape(encodeURIComponent(v))).map((c) => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
    case "bin-dec": {
      const parts = v.trim().split(/\s+/).filter(Boolean);
      let out = "";
      for (const p of parts) {
        if (!/^[01]+$/.test(p)) throw new Error("invalid binary: " + p);
        out += String.fromCharCode(parseInt(p, 2));
      }
      return decodeURIComponent(escape(out));
    }
    case "url-enc": return encodeURIComponent(v);
    case "url-dec": return decodeURIComponent(v);
    case "ascii-codes":
      return Array.from(v).map((c) => c.charCodeAt(0)).join(" ");
    case "reverse":
      return Array.from(v).reverse().join("");
    case "uppercase": return v.toUpperCase();
    case "lowercase": return v.toLowerCase();
    default: return v;
  }
}

// ---------- Unit panel ----------
function unitPanel() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Unit Converter", FK.el("span", { class: "badge" }, "convert")]));
  const catSel = FK.el("select", {}, UNIT_CATEGORIES.map((c) => FK.el("option", { value: c.id }, c.label)));
  catSel.value = "data";
  const valIn = FK.el("input", { type: "number", value: "1", step: "any" });
  const fromSel = FK.el("select", {});
  const toSel = FK.el("select", {});

  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Category"), catSel]));
  card.appendChild(FK.el("div", { class: "field-row" }, [
    FK.el("div", { class: "field" }, [FK.el("label", {}, "From"), fromSel]),
    FK.el("div", { class: "field" }, [FK.el("label", {}, "To"), toSel])
  ]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Value"), valIn]));

  const result = FK.el("div", { class: "result" });
  card.appendChild(result);

  function populateUnits() {
    const cat = UNIT_CATEGORIES.find((c) => c.id === catSel.value);
    fromSel.innerHTML = "";
    toSel.innerHTML = "";
    cat.units.forEach(([name], i) => {
      fromSel.appendChild(FK.el("option", { value: name }, name));
      toSel.appendChild(FK.el("option", { value: name }, name));
    });
    fromSel.value = cat.units[0][0];
    toSel.value = cat.units[Math.min(1, cat.units.length - 1)][0];
  }

  function compute() {
    const cat = UNIT_CATEGORIES.find((c) => c.id === catSel.value);
    const val = parseFloat(valIn.value);
    if (isNaN(val)) { result.innerHTML = '<div class="result-row"><span class="result-label">—</span><span class="result-value">enter value</span></div>'; return; }
    const from = cat.units.find((u) => u[0] === fromSel.value);
    const to = cat.units.find((u) => u[0] === toSel.value);
    if (!from || !to) return;
    let out;
    if (cat.id === "temp") {
      // Convert from -> C, then C -> to
      let c;
      if (from[0] === "C") c = val;
      else if (from[0] === "F") c = (val - 32) * 5/9;
      else c = val - 273.15;
      if (to[0] === "C") out = c;
      else if (to[0] === "F") out = c * 9/5 + 32;
      else out = c + 273.15;
    } else {
      const baseVal = val * from[1];
      out = baseVal / to[1];
    }
    const fmtOut = Math.abs(out) >= 1e6 || (Math.abs(out) > 0 && Math.abs(out) < 1e-4)
      ? out.toExponential(4)
      : parseFloat(out.toFixed(6)).toString();
    result.innerHTML = "";
    result.appendChild(row("Input", `${val} ${from[0]}`));
    result.appendChild(row("Result", `${fmtOut} ${to[0]}`, "ok"));
  }

  catSel.addEventListener("change", () => { populateUnits(); compute(); });
  fromSel.addEventListener("change", compute);
  toSel.addEventListener("change", compute);
  valIn.addEventListener("input", compute);
  populateUnits();
  compute();
  return card;
}

function row(label, value, cls = "") {
  return FK.el("div", { class: "result-row" }, [
    FK.el("span", { class: "result-label" }, label),
    FK.el("span", { class: "result-value" + (cls ? " " + cls : "") }, String(value))
  ]);
}
