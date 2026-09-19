// Learn module — flashcards and quiz, pulling from the same JSON datasets as Reference.
// No duplicate data entry: we fetch ports.json + acronyms.json and build decks on the fly.

const FK = window.FieldKit;

let cache = null;
async function loadData() {
  if (cache) return cache;
  const [ports, acronyms] = await Promise.all([
    fetch("data/ports.json").then((r) => r.json()),
    fetch("data/acronyms.json").then((r) => r.json()),
  ]);
  cache = { ports, acronyms };
  return cache;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function render(root) {
  root.appendChild(FK.el("div", { class: "card" }, [
    FK.el("h2", {}, ["Learn", FK.el("span", { class: "badge" }, "drill")]),
    FK.el("p", { class: "muted" }, "Flashcards and quizzes reuse the same data as Reference — no duplicate content to maintain.")
  ]));

  const chips = FK.el("div", { class: "chips" });
  let mode = "flash";
  const tabs = [["flash", "Flashcards"], ["quiz", "Quiz"]];
  tabs.forEach(([id, label]) => {
    chips.appendChild(FK.el("button", {
      class: "chip" + (id === mode ? " active" : ""),
      onclick: () => {
        mode = id;
        chips.querySelectorAll(".chip").forEach((c, i) => c.classList.toggle("active", tabs[i][0] === id));
        host.innerHTML = "";
        if (mode === "flash") mountFlash(host);
        else mountQuiz(host);
      }
    }, label));
  });
  root.appendChild(chips);
  const host = FK.el("div");
  root.appendChild(host);

  mountFlash(host);
}

// ---------- Flashcards ----------
async function mountFlash(host) {
  const loading = FK.el("div", { class: "empty" }, "Loading cards…");
  host.appendChild(loading);
  const data = await loadData();

  // Build OSI deck first (need to fetch separately).
  const osi = await fetch("data/osi.json").then((r) => r.json());

  // Deck selector
  const decks = [
    { id: "ports", label: "Common Ports", cards: data.ports.slice(0, 25).map((p) => ({ front: `Port ${p.port}`, back: `${p.name} — ${p.desc}` })) },
    { id: "acronyms", label: "Acronyms A–Z", cards: shuffle(data.acronyms).slice(0, 30).map((a) => ({ front: a.abbr, back: a.expansion })) },
    { id: "osi", label: "OSI Layers (from L7)", cards: [7,6,5,4,3,2,1].map((l) => {
        const o = osi.find((x) => x.layer === l);
        return { front: `Layer ${l}`, back: `${o.name} — ${o.examples}` };
      }) }
  ];

  loading.remove();

  const deckSel = FK.el("select", {}, decks.map((d) => FK.el("option", { value: d.id }, `${d.label} (${d.cards.length})`)));
  host.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Deck"), deckSel]));

  const cardHost = FK.el("div");
  host.appendChild(cardHost);

  let deck = decks[0];
  let idx = 0;
  let flipped = false;

  function renderCard() {
    deck = decks.find((d) => d.id === deckSel.value);
    idx = Math.min(idx, deck.cards.length - 1);
    const c = deck.cards[idx];
    flipped = false;
    cardHost.innerHTML = "";
    const card = FK.el("div", { class: "flashcard", onclick: () => { flipped = !flipped; refresh(); } });
    function refresh() {
      card.innerHTML = "";
      card.appendChild(FK.el("div", { class: "prompt" }, flipped ? "Answer" : "Prompt · tap to flip"));
      card.appendChild(FK.el("div", { class: "content" }, flipped ? c.back : c.front));
      if (flipped) card.appendChild(FK.el("div", { class: "answer" }, "✓ got it · ✗ review later"));
    }
    refresh();

    const controls = FK.el("div", { class: "btn-row", style: "margin-top:12px;" });
    controls.appendChild(FK.el("button", { class: "btn", onclick: () => { idx = (idx - 1 + deck.cards.length) % deck.cards.length; renderCard(); } }, "← Prev"));
    controls.appendChild(FK.el("span", { class: "muted", style: "flex:1;text-align:center;align-self:center;" }, `${idx + 1} / ${deck.cards.length}`));
    controls.appendChild(FK.el("button", { class: "btn primary", onclick: () => { idx = (idx + 1) % deck.cards.length; renderCard(); } }, "Next →"));
    cardHost.appendChild(controls);
  }

  deckSel.addEventListener("change", () => { idx = 0; renderCard(); });
  renderCard();
}

// ---------- Quiz ----------
async function mountQuiz(host) {
  const loading = FK.el("div", { class: "empty" }, "Loading quiz…");
  host.appendChild(loading);
  const data = await loadData();
  loading.remove();

  const quizzes = [
    {
      id: "portToName",
      label: "Port → Service (multiple choice)",
      makeQ: () => {
        const correct = data.ports[Math.floor(Math.random() * data.ports.length)];
        const wrong = shuffle(data.ports.filter((p) => p.port !== correct.port)).slice(0, 3);
        const opts = shuffle([correct, ...wrong]);
        return {
          q: `Which service runs on port ${correct.port}?`,
          opts: opts.map((o) => o.name),
          correct: correct.name,
        };
      }
    },
    {
      id: "acronymExpand",
      label: "Acronym → Expansion (multiple choice)",
      makeQ: () => {
        const correct = data.acronyms[Math.floor(Math.random() * data.acronyms.length)];
        const wrong = shuffle(data.acronyms.filter((a) => a.abbr !== correct.abbr)).slice(0, 3);
        const opts = shuffle([correct, ...wrong]);
        return {
          q: `What does ${correct.abbr} stand for?`,
          opts: opts.map((o) => o.expansion),
          correct: correct.expansion,
        };
      }
    },
    {
      id: "nameToPort",
      label: "Service → Port (multiple choice)",
      makeQ: () => {
        const correct = data.ports[Math.floor(Math.random() * data.ports.length)];
        const wrong = shuffle(data.ports.filter((p) => p.port !== correct.port)).slice(0, 3);
        const opts = shuffle([correct, ...wrong]);
        return {
          q: `Which port does ${correct.name} use?`,
          opts: opts.map((o) => String(o.port)),
          correct: String(correct.port),
        };
      }
    },
  ];

  const quizSel = FK.el("select", {}, quizzes.map((q) => FK.el("option", { value: q.id }, q.label)));
  host.appendChild(FK.el("div", { class: "field" }, [FK.el("label", {}, "Quiz type"), quizSel]));

  const scoreRow = FK.el("div", { class: "muted", style: "margin-bottom:10px;font-family:var(--mono);" }, "Score: 0 / 0");
  host.appendChild(scoreRow);

  const qHost = FK.el("div");
  host.appendChild(qHost);

  let answered = 0, correct = 0;
  let current = null;

  function next() {
    const q = quizzes.find((x) => x.id === quizSel.value);
    current = q.makeQ();
    qHost.innerHTML = "";
    qHost.appendChild(FK.el("div", { class: "card" }, [
      FK.el("h2", {}, ["Question " + (answered + 1)]),
      FK.el("div", { style: "font-size:15px;margin-bottom:12px;" }, current.q)
    ]));
    const optsHost = FK.el("div", {});
    current.opts.forEach((opt) => {
      const b = FK.el("button", { class: "btn", style: "width:100%;text-align:left;margin-bottom:6px;display:block;", onclick: () => answer(opt, b) }, opt);
      optsHost.appendChild(b);
    });
    qHost.appendChild(optsHost);
  }

  function answer(choice, btn) {
    if (!current) return;
    answered++;
    const isRight = choice === current.correct;
    if (isRight) correct++;
    scoreRow.textContent = `Score: ${correct} / ${answered}  (${answered ? Math.round(correct / answered * 100) : 0}%)`;
    qHost.querySelectorAll("button.btn").forEach((b) => {
      b.disabled = true;
      const t = b.textContent;
      if (t === current.correct) b.style.cssText = "width:100%;text-align:left;margin-bottom:6px;display:block;background:var(--accent);color:#0a1f15;border-color:var(--accent);font-weight:600;";
      else if (t === choice) b.style.cssText = "width:100%;text-align:left;margin-bottom:6px;display:block;background:var(--danger);color:#fff;border-color:var(--danger);";
      else b.style.opacity = "0.5";
    });
    const nextBtn = FK.el("button", { class: "btn primary", style: "margin-top:10px;width:100%;", onclick: () => next() }, "Next →");
    qHost.appendChild(nextBtn);
  }

  quizSel.addEventListener("change", () => { answered = 0; correct = 0; scoreRow.textContent = "Score: 0 / 0"; next(); });
  next();
}
