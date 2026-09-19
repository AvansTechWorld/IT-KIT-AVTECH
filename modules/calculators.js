// Calculators module — six tools, one shared input→live-result UI pattern.
// Each tool is a self-contained render function that re-computes on every input event.

const FK = window.FieldKit;

const TOOLS = [
  { id: "subnet",  label: "Subnet / CIDR" },
  { id: "vdrop",   label: "Voltage Drop" },
  { id: "ohm",     label: "Ohm's Law" },
  { id: "entropy", label: "Password Entropy" },
  { id: "sla",     label: "Uptime / SLA" },
  { id: "roi",     label: "ROI / TCO" },
];

// AWG circular-mil area lookup (solid copper). Index 0 = AWG 0000.
const AWG = [
  ["0000", 317.5], ["000", 252.0], ["00", 200.0], ["0", 159.0],
  ["2",  66.4], ["4",  41.7], ["6",  26.3], ["8",  16.5],
  ["10", 10.4], ["12", 6.53], ["14", 4.11], ["16", 2.58],
  ["18", 1.62], ["20", 1.02], ["22", 0.64],
];
// AWG → ohms per 1000 ft at 75°C (copper, NEC Table 8 approx)
const AWG_R = {
  "0000": 0.060, "000": 0.077, "00": 0.097, "0": 0.122,
  "2": 0.194, "4": 0.308, "6": 0.491, "8": 0.778,
  "10": 1.24, "12": 1.98, "14": 3.14, "16": 4.99, "18": 7.95, "20": 12.6, "22": 20.3,
};

export function render(root) {
  let active = "subnet";

  const wrap = FK.el("div");
  const chips = FK.el("div", { class: "chips" });
  TOOLS.forEach((t) => {
    const chip = FK.el("button", {
      class: "chip" + (t.id === active ? " active" : ""),
      onclick: () => { active = t.id; rerender(); }
    }, t.label);
    chips.appendChild(chip);
  });

  const toolHost = FK.el("div");

  function rerender() {
    chips.querySelectorAll(".chip").forEach((c, i) => c.classList.toggle("active", TOOLS[i].id === active));
    toolHost.innerHTML = "";
    toolHost.appendChild(renderTool(active));
  }

  wrap.appendChild(chips);
  wrap.appendChild(toolHost);
  root.appendChild(wrap);
  rerender();
}

function renderTool(id) {
  switch (id) {
    case "subnet":  return subnetTool();
    case "vdrop":   return vdropTool();
    case "ohm":     return ohmTool();
    case "entropy": return entropyTool();
    case "sla":     return slaTool();
    case "roi":     return roiTool();
  }
}

// ---------- Subnet / CIDR ----------
function subnetTool() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Subnet / CIDR ", FK.el("span", { class: "badge" }, "L3")]));
  const ipIn = FK.el("input", { type: "text", placeholder: "192.168.1.42/24", value: "192.168.1.42/24", inputmode: "text", autocapitalize: "none", spellcheck: "false" });
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "IP / CIDR"), ipIn]));
  const result = FK.el("div", { class: "result" });
  card.appendChild(result);

  function compute() {
    const raw = ipIn.value.trim();
    const m = raw.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\/(\d{1,2}))?$/);
    if (!m) {
      result.innerHTML = '<div class="result-row"><span class="result-label">Format</span><span class="result-value danger">Use 1.2.3.4/24</span></div>';
      return;
    }
    const ip = m[1].split(".").map(Number);
    if (ip.some((o) => o > 255)) { result.innerHTML = '<div class="result-row"><span class="result-label">Error</span><span class="result-value danger">Octet > 255</span></div>'; return; }
    const prefix = m[2] ? parseInt(m[2], 10) : 32;
    if (prefix > 32) { result.innerHTML = '<div class="result-row"><span class="result-label">Error</span><span class="result-value danger">Prefix > 32</span></div>'; return; }
    const ipInt = (ip[0] << 24) >>> 0 | (ip[1] << 16) | (ip[2] << 8) | ip[3];
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const network = (ipInt & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const hosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : (Math.pow(2, 32 - prefix) - 2);
    const toIp = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
    const bin = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].map((o) => o.toString(2).padStart(8, "0")).join(".");

    const rows = [
      ["Network",    toIp(network)],
      ["Broadcast",  toIp(broadcast)],
      ["Mask",       `${toIp(mask)}  /${prefix}`],
      ["Hosts",      hosts.toLocaleString()],
      ["First host", prefix >= 31 ? toIp(network) : toIp(network + 1)],
      ["Last host",  prefix >= 31 ? toIp(broadcast) : toIp(broadcast - 1)],
      ["Wildcard",   toIp((~mask) >>> 0)],
      ["Class",      ipClass(ip[0], prefix)],
    ];
    result.innerHTML = "";
    rows.forEach(([k, v]) => result.appendChild(row(k, v)));
    result.appendChild(row("Net (bin)", bin(network)));
  }
  ipIn.addEventListener("input", compute);
  compute();
  return card;
}

function ipClass(first, prefix) {
  if (prefix <= 8) return "Class A range";
  if (prefix <= 16) return "Class B range";
  if (prefix <= 24) return "Class C range";
  return "Subnet of class C";
}

// ---------- Voltage drop ----------
function vdropTool() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Voltage Drop ", FK.el("span", { class: "badge" }, "Power")]));
  const awgSel = FK.el("select", {}, AWG.map(([g]) => FK.el("option", { value: g }, `AWG ${g}`)));
  awgSel.value = "12";
  const lenIn = FK.el("input", { type: "number", value: "100", min: "0", step: "any" });
  const unitSel = FK.el("select", {}, [
    FK.el("option", { value: "ft" }, "feet"),
    FK.el("option", { value: "m" }, "meters")
  ]);
  const curIn = FK.el("input", { type: "number", value: "10", min: "0", step: "any" });
  const phaseSel = FK.el("select", {}, [
    FK.el("option", { value: "1" }, "1-phase"),
    FK.el("option", { value: "3" }, "3-phase")
  ]);
  const vIn = FK.el("input", { type: "number", value: "120", min: "0", step: "any" });

  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Wire gauge (AWG)"), awgSel]));
  card.appendChild(FK.el("div", { class: "field-row" }, [
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Length"), lenIn]),
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Unit"), unitSel])
  ]));
  card.appendChild(FK.el("div", { class: "field-row" }, [
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Current (A)"), curIn]),
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Phase"), phaseSel])
  ]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Source voltage (V)"), vIn]));

  const result = FK.el("div", { class: "result" });
  card.appendChild(result);

  function compute() {
    const g = awgSel.value;
    const r = AWG_R[g];
    if (!r) { result.innerHTML = '<div class="result-row"><span class="result-label">Error</span><span class="result-value danger">No R for AWG ' + g + '</span></div>'; return; }
    let len = parseFloat(lenIn.value) || 0;
    if (unitSel.value === "m") len *= 3.28084; // to feet
    const cur = parseFloat(curIn.value) || 0;
    const phase = parseInt(phaseSel.value, 10);
    const v = parseFloat(vIn.value) || 0;
    // Vd = 2 * R * L * I / 1000   (1-phase, round trip)
    // Vd = √3 * R * L * I / 1000  (3-phase)
    const k = phase === 3 ? Math.sqrt(3) : 2;
    const vd = (k * r * len * cur) / 1000;
    const pct = v > 0 ? (vd / v) * 100 : 0;
    const atLoad = v - vd;
    const verdict = pct < 3 ? "ok" : (pct < 5 ? "warn" : "danger");
    const verdictTxt = pct < 3 ? "Within 3% — good" : (pct < 5 ? "3–5% — borderline" : "Over 5% — upsizing recommended");

    result.innerHTML = "";
    result.appendChild(row("Voltage drop", `${vd.toFixed(2)} V`, verdict));
    result.appendChild(row("Drop %", `${pct.toFixed(2)} %`, verdict));
    result.appendChild(row("Voltage at load", `${atLoad.toFixed(2)} V`));
    result.appendChild(row("R per 1000 ft", `${r} Ω`));
    result.appendChild(row("Verdict", verdictTxt, verdict));
  }
  [awgSel, lenIn, unitSel, curIn, phaseSel, vIn].forEach((el) => el.addEventListener("input", compute));
  compute();
  return card;
}

// ---------- Ohm's law ----------
function ohmTool() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Ohm's Law ", FK.el("span", { class: "badge" }, "V=IR")]));
  card.appendChild(FK.el("p", { class: "muted" }, "Enter any two of V / I / R. The third is computed. Power is also shown."));
  const vIn = FK.el("input", { type: "number", value: "", placeholder: "leave blank to solve", step: "any" });
  const iIn = FK.el("input", { type: "number", value: "0.5", step: "any" });
  const rIn = FK.el("input", { type: "number", value: "12", step: "any" });

  card.appendChild(FK.el("div", { class: "field-row" }, [
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Voltage (V)"), vIn]),
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Current (A)"), iIn])
  ]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Resistance (Ω)"), rIn]));

  const result = FK.el("div", { class: "result" });
  card.appendChild(result);

  function compute() {
    const v = vIn.value === "" ? null : parseFloat(vIn.value);
    const i = iIn.value === "" ? null : parseFloat(iIn.value);
    const r = rIn.value === "" ? null : parseFloat(rIn.value);
    let V = v, I = i, R = r, P = null;

    if (V == null && I != null && R != null) V = I * R;
    else if (I == null && V != null && R != null) I = V / R;
    else if (R == null && V != null && I != null) R = V / I;
    else { result.innerHTML = '<div class="result-row"><span class="result-label">Need</span><span class="result-value warn">Two values required</span></div>'; return; }

    if (V != null && I != null) P = V * I;
    else if (V != null && R != null) P = (V * V) / R;
    else if (I != null && R != null) P = I * I * R;

    result.innerHTML = "";
    result.appendChild(row("Voltage", fmt(V) + " V"));
    result.appendChild(row("Current", fmt(I) + " A"));
    result.appendChild(row("Resistance", fmt(R) + " Ω"));
    result.appendChild(row("Power", P != null ? fmt(P) + " W" : "—"));
  }
  [vIn, iIn, rIn].forEach((el) => el.addEventListener("input", compute));
  compute();
  return card;
}

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1000 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) return n.toExponential(3);
  return parseFloat(n.toFixed(4)).toString();
}

// ---------- Password entropy ----------
function entropyTool() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Password Entropy ", FK.el("span", { class: "badge" }, "Security")]));
  const pwdIn = FK.el("input", { type: "text", placeholder: "type or paste a password", autocapitalize: "none", spellcheck: "false" });
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Password"), pwdIn]));

  const result = FK.el("div", { class: "result" });
  card.appendChild(result);

  function compute() {
    const p = pwdIn.value;
    if (!p) { result.innerHTML = '<div class="result-row"><span class="result-label">—</span><span class="result-value">enter a password</span></div>'; return; }
    let pool = 0;
    if (/[a-z]/.test(p)) pool += 26;
    if (/[A-Z]/.test(p)) pool += 26;
    if (/[0-9]/.test(p)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(p)) pool += 33; // common special chars
    const bits = p.length * Math.log2(pool || 1);
    // crack time @ 1e10 guesses/sec (offline GPU attack on a fast hash)
    const guesses = Math.pow(2, bits) / 2;
    const seconds = guesses / 1e10;
    const verdict = bits < 28 ? "very weak" : bits < 36 ? "weak" : bits < 60 ? "fair" : bits < 80 ? "strong" : "excellent";
    const verdictClass = bits < 36 ? "danger" : (bits < 60 ? "warn" : "ok");
    result.innerHTML = "";
    result.appendChild(row("Length", p.length));
    result.appendChild(row("Charset size", pool));
    result.appendChild(row("Entropy", `${bits.toFixed(1)} bits`, verdictClass));
    result.appendChild(row("Verdict", verdict, verdictClass));
    result.appendChild(row("Crack time (offline GPU)", humanDuration(seconds)));
  }
  pwdIn.addEventListener("input", compute);
  compute();
  return card;
}

function humanDuration(s) {
  if (s < 1) return "instant";
  const units = [
    ["year", 31557600], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]
  ];
  for (const [name, sec] of units) {
    const v = s / sec;
    if (v >= 1) {
      if (v > 1e9) return `> ${(v / 1e9).toFixed(1)} billion ${name}s`;
      if (v > 1e6) return `> ${(v / 1e6).toFixed(1)} million ${name}s`;
      if (v > 1e3) return `> ${(v / 1e3).toFixed(1)} thousand ${name}s`;
      return `~ ${v.toFixed(1)} ${name}${v === 1 ? "" : "s"}`;
    }
  }
  return "instant";
}

// ---------- Uptime / SLA ----------
function slaTool() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["Uptime / SLA ", FK.el("span", { class: "badge" }, "Ops")]));
  const pctIn = FK.el("input", { type: "number", value: "99.9", step: "any", min: "0", max: "100" });
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "SLA % (e.g. 99.9, 99.95, 99.99)"), pctIn]));

  const result = FK.el("div", { class: "result" });
  card.appendChild(result);

  function compute() {
    const pct = parseFloat(pctIn.value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      result.innerHTML = '<div class="result-row"><span class="result-label">Error</span><span class="result-value danger">0–100 only</span></div>'; return;
    }
    const downtime = 1 - pct / 100;
    const perDay = downtime * 86400;
    const perWeek = downtime * 604800;
    const perMonth = downtime * 2629800; // avg month
    const perYear = downtime * 31557600;
    const verdict = pct >= 99.99 ? "ok" : pct >= 99.5 ? "warn" : "danger";
    result.innerHTML = "";
    result.appendChild(row("SLA", pct + " %", verdict));
    result.appendChild(row("Per day", fmtDur(perDay)));
    result.appendChild(row("Per week", fmtDur(perWeek)));
    result.appendChild(row("Per month", fmtDur(perMonth)));
    result.appendChild(row("Per year", fmtDur(perYear)));
  }
  pctIn.addEventListener("input", compute);
  compute();
  return card;
}

function fmtDur(s) {
  if (s < 1) return "< 1 sec";
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s = Math.floor(s % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(" ") || "0s";
}

// ---------- ROI / TCO ----------
function roiTool() {
  const card = FK.el("section", { class: "card" });
  card.appendChild(FK.el("h2", {}, ["ROI / TCO ", FK.el("span", { class: "badge" }, "Business")]));
  const capexIn = FK.el("input", { type: "number", value: "5000", step: "any" });
  const opexYrIn = FK.el("input", { type: "number", value: "600", step: "any" });
  const benefitYrIn = FK.el("input", { type: "number", value: "2200", step: "any" });
  const yearsIn = FK.el("input", { type: "number", value: "3", step: "1", min: "1" });
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Upfront cost (CAPEX, $)"), capexIn]));
  card.appendChild(FK.el("div", { class: "field-row" }, [
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Yearly op cost ($)"), opexYrIn]),
    FK.el("div", { class: "field" }, [FK.el("label", {}, "Yearly benefit ($)"), benefitYrIn])
  ]));
  card.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Horizon (years)"), yearsIn]));

  const result = FK.el("div", { class: "result" });
  card.appendChild(result);

  function compute() {
    const capex = +capexIn.value || 0;
    const opex = +opexYrIn.value || 0;
    const benefit = +benefitYrIn.value || 0;
    const years = Math.max(1, parseInt(yearsIn.value, 10) || 1);
    const totalCost = capex + opex * years;
    const totalBenefit = benefit * years;
    const net = totalBenefit - totalCost;
    const roi = totalCost > 0 ? (net / totalCost) * 100 : 0;
    const tco = totalCost;
    // Payback period (years)
    const yearlyNet = benefit - opex;
    let payback = null;
    if (yearlyNet > 0) {
      payback = capex / yearlyNet;
    }
    const verdict = net > 0 ? "ok" : "danger";
    result.innerHTML = "";
    result.appendChild(row("Total cost (TCO)", `$${totalCost.toLocaleString()}`));
    result.appendChild(row("Total benefit", `$${totalBenefit.toLocaleString()}`));
    result.appendChild(row("Net", `${net < 0 ? "-" : ""}$${Math.abs(net).toLocaleString()}`, verdict));
    result.appendChild(row("ROI", `${roi.toFixed(1)} %`, verdict));
    result.appendChild(row("Payback", payback == null ? "never (yearly op cost ≥ benefit)" : `${payback.toFixed(2)} years`, payback != null && payback <= years ? "ok" : "warn"));
  }
  [capexIn, opexYrIn, benefitYrIn, yearsIn].forEach((el) => el.addEventListener("input", compute));
  compute();
  return card;
}

function row(label, value, cls = "") {
  return FK.el("div", { class: "result-row" }, [
    FK.el("span", { class: "result-label" }, label),
    FK.el("span", { class: "result-value" + (cls ? " " + cls : "") }, String(value))
  ]);
}
