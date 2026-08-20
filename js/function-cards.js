// Dashboard funkció-dobozok: Ruhátlan testsúlymérés, Szoptatás, Pelenkacsere,
// Egyéb — a demó (anyanotesz-demo.jsx) CollapsibleCard-jainak natív ES-modul
// portja. Minden doboz saját zárt állapotot tart a mezők értékeiről (nincs
// globális state-be kötve minden billentyűleütés/koppintás), csak a
// nyitott/csukott állapot és a mentés utáni adatfrissítés megy a store-on át.

import { setState } from "./state.js";
import { createDateField, createTimeField } from "./datetime-picker.js";
import { createNumberField, createToggleGroup, createPillGroup } from "./fields.js";
import { createWeightMeasurement, createFeeding, createDiaper, logCareDone, createQuestion, updateQuestion } from "./data.js";
import { refreshCareData } from "./session.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtDate(d) {
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.`;
}

function buildCollapsibleHeader({ icon, color, title, open, onToggle }) {
  const head = h("button", { className: "coll-head", onClick: onToggle });
  head.appendChild(h("span", { className: "coll-icon-chip", text: icon, style: { background: `color-mix(in srgb, ${color} 22%, var(--panel))` } }));
  head.appendChild(h("h3", { text: title }));
  head.appendChild(h("span", { className: "coll-chevron" + (open ? " open" : ""), text: "⌄" }));
  return head;
}

// ---- Ruhátlan testsúlymérés ----

export function buildWeightCard(st) {
  const card = h("div", { className: "card" });
  card.appendChild(buildCollapsibleHeader({
    icon: "⚖️", color: "var(--green)", title: "Ruhátlan testsúlymérés",
    open: st.weightOpen, onToggle: () => setState({ weightOpen: !st.weightOpen }),
  }));
  if (!st.weightOpen) return card;

  let weightWhen = new Date();
  let weightValue = "";

  const body = h("div", { className: "coll-body" });
  body.appendChild(h("div", {
    className: "hint-box",
    text: "Ez az érték adja az aktuális súly és a heti gyarapodás számításának alapját a gyerek-dobozban.",
  }));

  const dateField = createDateField({ label: "Dátum", value: weightWhen, onChange: (d) => { weightWhen = d; timeField.setValue(d); } });
  const timeField = createTimeField({ label: "Idő", value: weightWhen, onChange: (d) => { weightWhen = d; dateField.setValue(d); } });
  const grid = h("div", { className: "grid-2" }, [dateField.el, timeField.el]);
  body.appendChild(grid);

  const weightField = createNumberField({ label: "Súly", unit: "g", onChange: (v) => { weightValue = v; } });
  body.appendChild(weightField.el);

  const status = h("div", { className: "save-status" });
  const saveBtn = h("button", { className: "btn btn-primary", text: "Mentés", style: { marginTop: "2px" } });
  saveBtn.addEventListener("click", async () => {
    const weightG = parseInt(weightValue, 10);
    if (!weightValue || Number.isNaN(weightG) || weightG <= 0) {
      status.textContent = "Add meg a súlyt.";
      status.className = "save-status error";
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Mentés…";
    status.textContent = "";
    status.className = "save-status";
    try {
      await createWeightMeasurement({ babyId: st.activeBabyId, userId: st.session.user.id, measuredAt: weightWhen, weightG });
      status.textContent = "Mentve ✓";
      status.className = "save-status success";
      weightWhen = new Date();
      dateField.setValue(weightWhen);
      timeField.setValue(weightWhen);
      weightValue = "";
      weightField.setValue("");
    } catch (e) {
      status.textContent = e.message;
      status.className = "save-status error";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Mentés";
    }
  });
  body.append(saveBtn, status);

  card.appendChild(body);
  return card;
}

// ---- Szoptatás ----

export function buildFeedCard(st) {
  const card = h("div", { className: "card" });
  card.appendChild(buildCollapsibleHeader({
    icon: "💧", color: "var(--pink)", title: "Szoptatás",
    open: st.feedOpen, onToggle: () => setState({ feedOpen: !st.feedOpen }),
  }));
  if (!st.feedOpen) return card;

  let feedWhen = new Date();
  let feedEndWhen = new Date();
  let side = "left";
  let cantMeasure = false;
  let wStart = "";
  let wEnd = "";
  let extraMilk = "";
  let extraFormula = "";

  const body = h("div", { className: "coll-body" });

  const dateField = createDateField({ label: "Dátum", value: feedWhen, onChange: (d) => { feedWhen = d; startTimeField.setValue(d); } });
  body.appendChild(dateField.el);

  const startTimeField = createTimeField({ label: "Idő (kezdet)", value: feedWhen, onChange: (d) => { feedWhen = d; dateField.setValue(d); } });
  const endTimeField = createTimeField({ label: "Idő (befejezés)", value: feedEndWhen, onChange: (d) => { feedEndWhen = d; } });
  body.appendChild(h("div", { className: "grid-2" }, [startTimeField.el, endTimeField.el]));

  body.appendChild(h("label", { text: "Melyik oldalról", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
  const sideGroup = createToggleGroup({
    options: [{ key: "left", label: "🤱 Bal" }, { key: "right", label: "Jobb 🤱" }, { key: "both", label: "Mindkettő" }],
    value: side, color: "var(--pink)",
    onChange: (v) => { side = v; },
  });
  body.appendChild(h("div", { style: { marginBottom: "10px" } }, [sideGroup.el]));

  const measureRow = h("div", { className: "row-between" });
  measureRow.appendChild(h("span", { text: "Súly méréséhez", style: { fontSize: "12px", color: "var(--muted)" } }));
  const measureBtn = h("button", { className: "measure-toggle", text: "Nem mérhető most" });
  measureRow.appendChild(measureBtn);
  body.appendChild(measureRow);

  const weightGrid = h("div", { className: "grid-2" });
  const wStartField = createNumberField({ label: "Súly – elején", unit: "g", onChange: (v) => { wStart = v; updateEstimate(); } });
  const wEndField = createNumberField({ label: "Súly – végén", unit: "g", onChange: (v) => { wEnd = v; updateEstimate(); } });
  weightGrid.append(wStartField.el, wEndField.el);
  body.appendChild(weightGrid);

  const estimateBox = h("div", { className: "estimate-box", style: { display: "none" } });
  body.appendChild(estimateBox);

  function updateEstimate() {
    if (cantMeasure) { estimateBox.style.display = "none"; return; }
    const s = parseFloat(wStart);
    const e = parseFloat(wEnd);
    if (Number.isNaN(s) || Number.isNaN(e)) { estimateBox.style.display = "none"; return; }
    const est = Math.max(0, Math.round(e - s));
    estimateBox.innerHTML = "";
    estimateBox.appendChild(h("span", { text: "Becsült elfogyasztott mennyiség: " }));
    estimateBox.appendChild(h("b", { text: `≈ ${est} g` }));
    estimateBox.style.display = "";
  }

  measureBtn.addEventListener("click", () => {
    cantMeasure = !cantMeasure;
    measureBtn.classList.toggle("active", cantMeasure);
    measureBtn.textContent = cantMeasure ? "✓ Nem mérhető most" : "Nem mérhető most";
    weightGrid.style.display = cantMeasure ? "none" : "";
    updateEstimate();
  });

  const extraGrid = h("div", { className: "grid-2" });
  const extraMilkField = createNumberField({ label: "+ Anyatej", unit: "ml", onChange: (v) => { extraMilk = v; } });
  const extraFormulaField = createNumberField({ label: "+ Tápszer", unit: "ml", onChange: (v) => { extraFormula = v; } });
  extraGrid.append(extraMilkField.el, extraFormulaField.el);
  body.appendChild(extraGrid);

  const status = h("div", { className: "save-status" });
  const saveBtn = h("button", { className: "btn btn-primary", text: "Mentés", style: { marginTop: "2px" } });
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Mentés…";
    status.textContent = "";
    status.className = "save-status";
    try {
      const endedAt = new Date(feedWhen.getFullYear(), feedWhen.getMonth(), feedWhen.getDate(), feedEndWhen.getHours(), feedEndWhen.getMinutes());
      await createFeeding({
        babyId: st.activeBabyId,
        userId: st.session.user.id,
        side,
        startedAt: feedWhen,
        endedAt,
        cantMeasure,
        weightBeforeG: wStart ? parseInt(wStart, 10) : null,
        weightAfterG: wEnd ? parseInt(wEnd, 10) : null,
        extraMilkMl: extraMilk ? parseInt(extraMilk, 10) : null,
        extraFormulaMl: extraFormula ? parseInt(extraFormula, 10) : null,
      });
      status.textContent = "Mentve ✓";
      status.className = "save-status success";

      feedWhen = new Date();
      feedEndWhen = new Date();
      dateField.setValue(feedWhen);
      startTimeField.setValue(feedWhen);
      endTimeField.setValue(feedEndWhen);
      side = "left";
      sideGroup.setValue("left");
      cantMeasure = false;
      measureBtn.classList.remove("active");
      measureBtn.textContent = "Nem mérhető most";
      weightGrid.style.display = "";
      wStart = ""; wEnd = ""; extraMilk = ""; extraFormula = "";
      wStartField.setValue(""); wEndField.setValue("");
      extraMilkField.setValue(""); extraFormulaField.setValue("");
      updateEstimate();
    } catch (e) {
      status.textContent = e.message;
      status.className = "save-status error";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Mentés";
    }
  });
  body.append(saveBtn, status);

  card.appendChild(body);
  return card;
}

// ---- Pelenkacsere ----

export function buildDiaperCard(st) {
  const card = h("div", { className: "card" });
  card.appendChild(buildCollapsibleHeader({
    icon: "🧷", color: "var(--amber)", title: "Pelenkacsere",
    open: st.diaperOpen, onToggle: () => setState({ diaperOpen: !st.diaperOpen }),
  }));
  if (!st.diaperOpen) return card;

  let diaperWhen = new Date();
  let diaperType = "kaki";
  let poopColor = "sárga";
  let poopTexture = "pépes";

  const body = h("div", { className: "coll-body" });

  const dateField = createDateField({ label: "Dátum", value: diaperWhen, onChange: (d) => { diaperWhen = d; timeField.setValue(d); } });
  const timeField = createTimeField({ label: "Idő", value: diaperWhen, onChange: (d) => { diaperWhen = d; dateField.setValue(d); } });
  body.appendChild(h("div", { className: "grid-2" }, [dateField.el, timeField.el]));

  body.appendChild(h("label", { text: "Típus", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
  const typeGroup = createToggleGroup({
    options: [{ key: "pisi", label: "Pisi" }, { key: "kaki", label: "Kaki" }, { key: "mindketto", label: "Mindkettő" }],
    value: diaperType, color: "var(--amber)",
    onChange: (v) => { diaperType = v; updatePoopFieldsVisibility(); },
  });
  body.appendChild(h("div", { style: { marginBottom: "10px" } }, [typeGroup.el]));

  const poopWrap = h("div");
  poopWrap.appendChild(h("label", { text: "Szín", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
  const colorGroup = createPillGroup({
    options: ["sárga", "zöld", "barna", "fekete", "vörös", "fehér-szürke"],
    value: poopColor,
    onChange: (v) => { poopColor = v; },
  });
  poopWrap.appendChild(colorGroup.el);
  poopWrap.appendChild(h("label", { text: "Állag", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", margin: "6px 0 4px" } }));
  const textureGroup = createPillGroup({
    options: ["pépes", "szilárd", "híg-vizes", "nyákos"],
    value: poopTexture,
    onChange: (v) => { poopTexture = v; },
  });
  poopWrap.appendChild(textureGroup.el);
  body.appendChild(poopWrap);

  function updatePoopFieldsVisibility() {
    poopWrap.style.display = diaperType === "pisi" ? "none" : "";
  }
  updatePoopFieldsVisibility();

  const noteWrap = h("div", { className: "field" });
  noteWrap.appendChild(h("label", { text: "Jegyzet (opcionális)" }));
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.placeholder = "pl. szokatlan szag...";
  noteWrap.appendChild(noteInput);
  body.appendChild(noteWrap);

  const status = h("div", { className: "save-status" });
  const saveBtn = h("button", { className: "btn btn-primary", text: "Mentés", style: { marginTop: "2px" } });
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Mentés…";
    status.textContent = "";
    status.className = "save-status";
    try {
      await createDiaper({
        babyId: st.activeBabyId,
        userId: st.session.user.id,
        type: diaperType,
        poopColor,
        poopTexture,
        note: noteInput.value.trim(),
        changedAt: diaperWhen,
      });
      status.textContent = "Mentve ✓";
      status.className = "save-status success";

      diaperWhen = new Date();
      dateField.setValue(diaperWhen);
      timeField.setValue(diaperWhen);
      diaperType = "kaki";
      typeGroup.setValue("kaki");
      poopColor = "sárga";
      colorGroup.setValue("sárga");
      poopTexture = "pépes";
      textureGroup.setValue("pépes");
      updatePoopFieldsVisibility();
      noteInput.value = "";
    } catch (e) {
      status.textContent = e.message;
      status.className = "save-status error";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Mentés";
    }
  });
  body.append(saveBtn, status);

  card.appendChild(body);
  return card;
}

// ---- Egyéb: ismétlődő teendők ----
// A sablonok (név, gyakoriság, kategória) a Karbantartás oldalon szabadon
// szerkeszthetők — lásd maintenance-page.js —, ezért itt semmi sem lehet
// névre hardkódolva: a szöveg a category mezőből, a "hányadika esedékes"
// logika pedig a frequency-ből (daily/weekly/monthly) adódik.

const FREQ_NOUN = { daily: "naponta", weekly: "hetente", monthly: "havonta" };

function nextDueDate(lastGiven, frequency) {
  if (frequency === "weekly") {
    const d = new Date(lastGiven);
    d.setDate(d.getDate() + 7);
    return d;
  }
  return new Date(lastGiven.getFullYear(), lastGiven.getMonth() + 1, lastGiven.getDate());
}

function buildCareRow(template, careLogs, babyId, userId, onLogged) {
  const now = new Date();
  const logs = careLogs
    .filter((l) => l.template_id === template.id)
    .sort((a, b) => new Date(b.done_at) - new Date(a.done_at));
  const latest = logs[0] || null;
  const isActivity = template.category === "activity";

  function buildActionBtn(text) {
    const btn = h("button", { className: "care-btn", text });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Mentés…";
      try {
        await logCareDone({ templateId: template.id, babyId, userId, doneAt: new Date() });
        await onLogged();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = text;
        alert(e.message);
      }
    });
    return btn;
  }

  if (template.frequency === "daily") {
    const doneToday = latest && new Date(latest.done_at).toDateString() === now.toDateString();
    const verb = isActivity ? "Megtörtént" : "Beadva";
    const warnText = isActivity ? "Ma még nem történt meg" : "Ma még nem adva";

    const row = h("div", { className: "care-row" + (doneToday ? "" : " alert") });
    const info = h("div");
    info.appendChild(h("div", { className: "care-name", text: template.name }));
    info.appendChild(h("div", { className: "care-freq", text: "naponta" }));
    if (!doneToday) {
      info.appendChild(h("div", { className: "care-status-alert" }, [h("span", { text: "⚠" }), h("span", { text: warnText })]));
    }
    row.appendChild(info);

    if (doneToday) {
      row.appendChild(h("button", { className: "care-btn done", text: `✓ ${verb}` }));
    } else {
      row.appendChild(buildActionBtn("Jelölöm"));
    }
    return row;
  }

  // heti vagy havi gyakoriságú (pl. K-vitamin — havonta)
  const freqNoun = FREQ_NOUN[template.frequency];
  const verb = isActivity ? "Megtörtént" : "Beadva";
  const actionLabel = isActivity ? "Megtörtént ma" : "Beadva ma";

  if (!latest) {
    const row = h("div", { className: "care-row alert" });
    const info = h("div");
    info.appendChild(h("div", { className: "care-name", text: template.name }));
    info.appendChild(h("div", { className: "care-freq", text: freqNoun }));
    info.appendChild(h("div", { className: "care-status-alert" }, [h("span", { text: "⚠" }), h("span", { text: "Esedékes" })]));
    row.appendChild(info);
    row.appendChild(buildActionBtn(actionLabel));
    return row;
  }

  const lastGiven = new Date(latest.done_at);
  const nextDue = nextDueDate(lastGiven, template.frequency);
  const daysLeft = Math.ceil((nextDue - now) / 86400000);
  const due = daysLeft <= 0;

  const row = h("div", { className: "care-row" + (due ? " alert" : "") });
  const info = h("div");
  info.appendChild(h("div", { className: "care-name", text: template.name }));
  info.appendChild(h("div", { className: "care-freq", text: `${freqNoun} · legutóbb ${fmtDate(lastGiven)}` }));
  if (due) {
    info.appendChild(h("div", { className: "care-status-alert" }, [h("span", { text: "⚠" }), h("span", { text: `Esedékes, eltelt egy ${template.frequency === "weekly" ? "hét" : "hónap"}` })]));
  } else {
    info.appendChild(h("div", { className: "care-status-ok" }, [h("span", { text: "✓" }), h("span", { text: `${verb} · következő: ${fmtDate(nextDue)} (még ${daysLeft} nap)` })]));
  }
  row.appendChild(info);
  if (due) row.appendChild(buildActionBtn(actionLabel));
  return row;
}

const FREQ_ORDER = { daily: 0, weekly: 1, monthly: 2 };

export function buildOtherCard(st) {
  const card = h("div", { className: "card" });
  card.appendChild(buildCollapsibleHeader({
    icon: "🩺", color: "var(--accent)", title: "Egyéb",
    open: st.otherOpen, onToggle: () => setState({ otherOpen: !st.otherOpen }),
  }));
  if (!st.otherOpen) return card;

  const body = h("div", { className: "coll-body" });
  const templates = [...st.careTemplates].sort((a, b) => {
    const freqDiff = FREQ_ORDER[a.frequency] - FREQ_ORDER[b.frequency];
    return freqDiff !== 0 ? freqDiff : a.name.localeCompare(b.name, "hu");
  });

  if (templates.length === 0) {
    body.appendChild(h("div", { className: "hint-box", text: "Betöltés…" }));
  } else {
    templates.forEach((t) => {
      body.appendChild(buildCareRow(t, st.careLogs, st.activeBabyId, st.session.user.id, () => refreshCareData(st.activeBabyId)));
    });
  }

  card.appendChild(body);
  return card;
}

// ---- Kérdések a védőnőnek / orvosnak ----

function buildFilterChip(label, active, color) {
  const chip = h("button", { className: "pill" + (active ? " active" : ""), text: label });
  chip.style.setProperty("--chip-color", color);
  return chip;
}

export function buildQuestionsCard(st) {
  const card = h("div", { className: "card" });
  card.appendChild(buildCollapsibleHeader({
    icon: "❓", color: "var(--faint)", title: "Kérdések a védőnőnek / orvosnak",
    open: st.questionsOpen, onToggle: () => setState({ questionsOpen: !st.questionsOpen }),
  }));
  if (!st.questionsOpen) return card;

  const babyId = st.activeBabyId;
  const userId = st.session.user.id;
  const questions = [...st.questions];

  let recipientFilter = "all";
  let statusFilter = "all";
  let expandedId = null;

  const body = h("div", { className: "coll-body" });

  const recRow = h("div", { className: "pill-row", style: { marginBottom: "6px" } });
  const recOptions = [["all", "Mind"], ["vedono", "Védőnő"], ["orvos", "Orvos"]];
  recOptions.forEach(([key, label]) => {
    const chip = buildFilterChip(label, key === recipientFilter, "var(--faint)");
    chip.addEventListener("click", () => { recipientFilter = key; renderList(); });
    recRow.appendChild(chip);
  });
  body.appendChild(recRow);

  const statusRow = h("div", { className: "pill-row" });
  const statusOptions = [["all", "Mind"], ["open", "Még nem válaszolt"], ["answered", "Megválaszolt"]];
  statusOptions.forEach(([key, label]) => {
    const chip = buildFilterChip(label, key === statusFilter, "var(--faint)");
    chip.addEventListener("click", () => { statusFilter = key; renderList(); });
    statusRow.appendChild(chip);
  });
  body.appendChild(statusRow);

  function updateFilterChips() {
    Array.from(recRow.children).forEach((chip, i) => chip.classList.toggle("active", recOptions[i][0] === recipientFilter));
    Array.from(statusRow.children).forEach((chip, i) => chip.classList.toggle("active", statusOptions[i][0] === statusFilter));
  }

  const listWrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", margin: "10px 0" } });
  body.appendChild(listWrap);

  function renderList() {
    updateFilterChips();
    listWrap.innerHTML = "";
    const filtered = questions.filter((q) =>
      (recipientFilter === "all" || q.recipient === recipientFilter) &&
      (statusFilter === "all" || (statusFilter === "answered" ? q.answered : !q.answered))
    );
    if (filtered.length === 0) {
      listWrap.appendChild(h("div", { className: "hint-box", text: "Nincs a szűrésnek megfelelő kérdés." }));
      return;
    }
    filtered.forEach((q) => listWrap.appendChild(buildQuestionRow(q)));
  }

  function buildQuestionRow(q) {
    const row = h("div", { className: "question-row" });
    const isOpen = expandedId === q.id;
    const recLabel = q.recipient === "vedono" ? "Védőnő" : "Orvos";
    const recColor = q.recipient === "vedono" ? "var(--pink)" : "var(--accent)";

    const head = h("button", { className: "question-head" });
    head.appendChild(h("span", { className: "question-dot", style: { background: q.answered ? "var(--green)" : "var(--amber)" } }));
    const tag = h("span", { className: "question-recipient-tag", text: recLabel, style: { color: recColor, background: `color-mix(in srgb, ${recColor} 25%, var(--panel))` } });
    head.appendChild(tag);
    head.appendChild(h("span", { className: "question-text" + (q.answered ? " answered" : ""), text: q.text }));
    head.appendChild(h("span", { className: "coll-chevron" + (isOpen ? " open" : ""), text: "⌄" }));
    head.addEventListener("click", () => { expandedId = isOpen ? null : q.id; renderList(); });
    row.appendChild(head);

    if (isOpen) {
      const detail = h("div", { className: "question-detail" });

      detail.appendChild(h("label", { text: "Kinek szól", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
      const recGroup = createToggleGroup({
        options: [{ key: "vedono", label: "Védőnő" }, { key: "orvos", label: "Orvos" }],
        value: q.recipient, color: recColor,
        onChange: async (v) => {
          const prev = q.recipient;
          q.recipient = v;
          try { await updateQuestion(q.id, { recipient: v }); setState({ questions: [...questions] }); }
          catch (e) { q.recipient = prev; alert(e.message); renderList(); }
        },
      });
      detail.appendChild(h("div", { style: { marginBottom: "10px" } }, [recGroup.el]));

      detail.appendChild(h("label", { text: "Válasz", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
      const answerInput = document.createElement("textarea");
      answerInput.className = "answer-input";
      answerInput.rows = 3;
      answerInput.placeholder = "Ide írható a kapott válasz...";
      answerInput.value = q.answer || "";
      answerInput.addEventListener("blur", async () => {
        const value = answerInput.value;
        if (value === (q.answer || "")) return;
        try { await updateQuestion(q.id, { answer: value }); q.answer = value; setState({ questions: [...questions] }); }
        catch (e) { alert(e.message); }
      });
      detail.appendChild(h("div", { style: { marginBottom: "10px" } }, [answerInput]));

      detail.appendChild(h("label", { text: "Állapot", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
      const statusGroup = createToggleGroup({
        options: [{ key: "open", label: "Még aktuális" }, { key: "answered", label: "Megválaszolva" }],
        value: q.answered ? "answered" : "open", color: q.answered ? "var(--green)" : "var(--amber)",
        onChange: async (v) => {
          const prev = q.answered;
          const nv = v === "answered";
          q.answered = nv;
          try { await updateQuestion(q.id, { answered: nv }); setState({ questions: [...questions] }); }
          catch (e) { q.answered = prev; alert(e.message); renderList(); }
        },
      });
      detail.appendChild(statusGroup.el);

      row.appendChild(detail);
    }

    return row;
  }

  renderList();

  body.appendChild(h("label", { text: "Kinek szól az új kérdés", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
  let newRecipient = "vedono";
  const newRecGroup = createToggleGroup({
    options: [{ key: "vedono", label: "Védőnő" }, { key: "orvos", label: "Orvos" }],
    value: newRecipient, color: "var(--pink)",
    onChange: (v) => { newRecipient = v; },
  });
  body.appendChild(h("div", { style: { marginBottom: "8px" } }, [newRecGroup.el]));

  const newRow = h("div", { className: "new-question-row" });
  const newInput = document.createElement("input");
  newInput.type = "text";
  newInput.placeholder = "Új kérdés...";
  newRow.appendChild(newInput);
  const addBtn = h("button", { className: "new-question-add-btn", text: "+" });
  addBtn.addEventListener("click", async () => {
    const text = newInput.value.trim();
    if (!text) return;
    addBtn.disabled = true;
    try {
      const created = await createQuestion({ babyId, userId, text, recipient: newRecipient });
      setState({ questions: [created, ...st.questions] });
    } catch (e) {
      alert(e.message);
      addBtn.disabled = false;
    }
  });
  newRow.appendChild(addBtn);
  body.appendChild(newRow);

  card.appendChild(body);
  return card;
}
