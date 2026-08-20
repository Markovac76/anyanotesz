// Historikus adatok oldal — a demó (anyanotesz-demo.jsx) "history" nézetének
// natív ES-modul portja: kronologikus, szűrhető lista + szerkesztő modal.
// A "Ruhátlan testsúlymérés" bejegyzések itt sem jelennek meg (a demó
// TYPE_META-ja is csak feed/diaper/other típust ismer).

import { setState } from "./state.js";
import { createDateField, createTimeField } from "./datetime-picker.js";
import { createNumberField, createToggleGroup, createPillGroup } from "./fields.js";
import {
  getHistoryEntries,
  updateFeedingEntry, deleteFeedingEntry,
  updateDiaperEntry, deleteDiaperEntry,
  updateCareLogEntry, deleteCareLogEntry,
} from "./history.js";
import { closeHistory, openGraphs } from "./session.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function pad(n) { return String(n).padStart(2, "0"); }

const HU_DAYS = ["h", "k", "sze", "cs", "p", "szo", "v"];

function relLabel(d) {
  const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "ma";
  if (sameDay(d, yesterday)) return "tegnap";
  return HU_DAYS[(d.getDay() + 6) % 7];
}

function entryDateTimeLabel(d) {
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())} · ${relLabel(d)}`;
}

function entryDetail(e) {
  if (e.type === "feed") {
    const sideLabel = e.side === "left" ? "Bal mell" : e.side === "right" ? "Jobb mell" : "Mindkét mell";
    let s = sideLabel;
    if (e.cantMeasure) {
      s += " · nem mérhető";
    } else if (e.wStart && e.wEnd) {
      const est = Math.max(0, Math.round(parseFloat(e.wEnd) - parseFloat(e.wStart)));
      s += ` · ${e.wStart}→${e.wEnd} g (≈${est} g)`;
    }
    if (e.extraMilk) s += ` · +${e.extraMilk} ml anyatej`;
    if (e.extraFormula) s += ` · +${e.extraFormula} ml tápszer`;
    return s;
  }
  if (e.type === "diaper") {
    let s = e.diaperType === "pisi" ? "Pisi" : e.diaperType === "kaki" ? "Kaki" : "Pisi + kaki";
    if (e.diaperType !== "pisi") s += ` · ${e.poopColor}, ${e.poopTexture}`;
    if (e.note) s += ` · ${e.note}`;
    return s;
  }
  const verb = e.templateName === "Köldökápolás" ? "megtörtént" : "beadva";
  return `${e.templateName} ${verb}`;
}

const TYPE_META = {
  feed: { label: "Szoptatás", color: "var(--pink)", icon: "💧" },
  diaper: { label: "Pelenkacsere", color: "var(--amber)", icon: "🧷" },
  other: { label: "Egyéb", color: "var(--accent)", icon: "🩺" },
};

export function buildHistoryPage(st) {
  const wrap = h("div");

  const headRow = h("div", { className: "history-head-row" });
  const backBtn = h("button", { className: "back-btn", onClick: () => closeHistory() });
  backBtn.append(h("span", { text: "←" }), h("span", { text: "Vissza" }));
  headRow.append(backBtn, h("h2", { className: "history-title", text: "Historikus adatok" }));
  wrap.appendChild(headRow);

  const actionRow = h("div", { className: "history-action-row" });
  const graphBtn = h("button", { className: "history-action-btn" });
  graphBtn.append(h("span", { text: "📊" }), h("span", { text: "Grafikonok" }));
  graphBtn.addEventListener("click", () => openGraphs(st.activeBabyId));
  const excelBtn = h("button", { className: "history-action-btn" });
  excelBtn.append(h("span", { text: "⬇️" }), h("span", { text: "Excel export" }));
  excelBtn.addEventListener("click", () => setState({
    infoModal: { title: "Fejlesztés alatt", message: "Az Excel export jelenleg nem elérhető funkció, ez egy későbbi fejlesztés része lesz." },
  }));
  actionRow.append(graphBtn, excelBtn);
  wrap.appendChild(actionRow);

  const filterRow = h("div", { className: "history-filter-row" });
  Object.entries(TYPE_META).forEach(([key, meta]) => {
    const active = st.historyFilters[key];
    const chip = h("button", { className: "pill" + (active ? " active" : ""), text: meta.label });
    chip.style.setProperty("--chip-color", meta.color);
    chip.addEventListener("click", () => setState({ historyFilters: { ...st.historyFilters, [key]: !active } }));
    filterRow.appendChild(chip);
  });
  wrap.appendChild(filterRow);

  const listWrap = h("div");
  const filtered = st.historyEntries.filter((e) => st.historyFilters[e.type]);
  if (filtered.length === 0) {
    listWrap.appendChild(h("div", { className: "hint-box", text: "Nincs a szűrésnek megfelelő bejegyzés.", style: { textAlign: "center" } }));
  } else {
    filtered.forEach((e) => listWrap.appendChild(buildHistoryRow(e)));
  }
  wrap.appendChild(listWrap);

  if (st.historyEditing) {
    const entry = st.historyEntries.find((e) => e.type === st.historyEditing.type && e.id === st.historyEditing.id);
    if (entry) openEditModal(entry, st.activeBabyId);
  }

  return wrap;
}

function buildHistoryRow(entry) {
  const meta = TYPE_META[entry.type];
  const row = h("div", { className: "history-row" });
  row.appendChild(h("div", { className: "history-row-icon", text: meta.icon, style: { background: `color-mix(in srgb, ${meta.color} 22%, var(--panel))`, color: meta.color } }));
  const bodyEl = h("div", { className: "history-row-body" });
  bodyEl.appendChild(h("div", { className: "history-row-when", text: entryDateTimeLabel(entry.when) }));
  bodyEl.appendChild(h("div", { className: "history-row-detail", text: entryDetail(entry) }));
  row.appendChild(bodyEl);
  const editBtn = h("button", { className: "history-row-edit" });
  editBtn.append(h("span", { text: "✏️" }), h("span", { text: "Módosítás" }));
  editBtn.addEventListener("click", () => setState({ historyEditing: { type: entry.type, id: entry.id } }));
  row.appendChild(editBtn);
  return row;
}

// ---- Szerkesztő modal ----

function openEditModal(entry, babyId) {
  const existing = document.getElementById("history-edit-modal");
  if (existing) existing.remove();

  const meta = TYPE_META[entry.type];
  let when = entry.when;
  let confirmDelete = false;

  const backdrop = h("div", { className: "modal-backdrop" });
  backdrop.id = "history-edit-modal";
  const sheet = h("div", { className: "modal-sheet", style: { maxHeight: "88vh", overflowY: "auto" } });
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  sheet.addEventListener("click", (e) => e.stopPropagation());

  const headEl = h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" } });
  headEl.appendChild(h("div", { className: "coll-icon-chip", text: meta.icon, style: { background: `color-mix(in srgb, ${meta.color} 22%, var(--panel))`, color: meta.color } }));
  headEl.appendChild(h("h3", { text: `${meta.label} módosítása`, style: { fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "700", margin: 0, flex: 1 } }));
  sheet.appendChild(headEl);

  const dateField = createDateField({ label: "Dátum", value: when, onChange: (d) => { when = d; timeField.setValue(d); } });
  const timeField = createTimeField({ label: "Idő", value: when, onChange: (d) => { when = d; dateField.setValue(d); } });
  sheet.appendChild(h("div", { className: "grid-2" }, [dateField.el, timeField.el]));

  // ---- típus-specifikus mezők ----
  let side = entry.side, cantMeasure = entry.cantMeasure, wStart = entry.wStart, wEnd = entry.wEnd, extraMilk = entry.extraMilk, extraFormula = entry.extraFormula;
  let diaperType = entry.diaperType, poopColor = entry.poopColor, poopTexture = entry.poopTexture, note = entry.note;
  let wStartField, wEndField, extraMilkField, extraFormulaField, weightGrid, estimateBox, measureBtn, colorGroup, textureGroup, poopWrap, noteInput;

  if (entry.type === "feed") {
    sheet.appendChild(h("label", { text: "Melyik oldalról", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
    const sideGroup = createToggleGroup({
      options: [{ key: "left", label: "Bal" }, { key: "right", label: "Jobb" }, { key: "both", label: "Mindkettő" }],
      value: side, color: "var(--pink)",
      onChange: (v) => { side = v; },
    });
    sheet.appendChild(h("div", { style: { marginBottom: "10px" } }, [sideGroup.el]));

    const measureRow = h("div", { className: "row-between" });
    measureRow.appendChild(h("span", { text: "Súly méréséhez", style: { fontSize: "12px", color: "var(--muted)" } }));
    measureBtn = h("button", { className: "measure-toggle" + (cantMeasure ? " active" : ""), text: cantMeasure ? "✓ Nem mérhető" : "Nem mérhető" });
    measureRow.appendChild(measureBtn);
    sheet.appendChild(measureRow);

    weightGrid = h("div", { className: "grid-2", style: { display: cantMeasure ? "none" : "" } });
    wStartField = createNumberField({ label: "Súly – elején", unit: "g", value: wStart, onChange: (v) => { wStart = v; updateEstimate(); } });
    wEndField = createNumberField({ label: "Súly – végén", unit: "g", value: wEnd, onChange: (v) => { wEnd = v; updateEstimate(); } });
    weightGrid.append(wStartField.el, wEndField.el);
    sheet.appendChild(weightGrid);

    estimateBox = h("div", { className: "estimate-box", style: { display: "none" } });
    sheet.appendChild(estimateBox);

    function updateEstimate() {
      if (cantMeasure) { estimateBox.style.display = "none"; return; }
      const s = parseFloat(wStart), e = parseFloat(wEnd);
      if (Number.isNaN(s) || Number.isNaN(e)) { estimateBox.style.display = "none"; return; }
      const est = Math.max(0, Math.round(e - s));
      estimateBox.innerHTML = "";
      estimateBox.appendChild(h("span", { text: "Becsült elfogyasztott mennyiség: " }));
      estimateBox.appendChild(h("b", { text: `≈ ${est} g` }));
      estimateBox.style.display = "";
    }
    updateEstimate();

    measureBtn.addEventListener("click", () => {
      cantMeasure = !cantMeasure;
      measureBtn.classList.toggle("active", cantMeasure);
      measureBtn.textContent = cantMeasure ? "✓ Nem mérhető" : "Nem mérhető";
      weightGrid.style.display = cantMeasure ? "none" : "";
      updateEstimate();
    });

    const extraGrid = h("div", { className: "grid-2" });
    extraMilkField = createNumberField({ label: "+ Anyatej", unit: "ml", value: extraMilk, onChange: (v) => { extraMilk = v; } });
    extraFormulaField = createNumberField({ label: "+ Tápszer", unit: "ml", value: extraFormula, onChange: (v) => { extraFormula = v; } });
    extraGrid.append(extraMilkField.el, extraFormulaField.el);
    sheet.appendChild(extraGrid);
  }

  if (entry.type === "diaper") {
    sheet.appendChild(h("label", { text: "Típus", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
    const typeGroup = createToggleGroup({
      options: [{ key: "pisi", label: "Pisi" }, { key: "kaki", label: "Kaki" }, { key: "mindketto", label: "Mindkettő" }],
      value: diaperType, color: "var(--amber)",
      onChange: (v) => { diaperType = v; updatePoopVisibility(); },
    });
    sheet.appendChild(h("div", { style: { marginBottom: "10px" } }, [typeGroup.el]));

    poopWrap = h("div");
    poopWrap.appendChild(h("label", { text: "Szín", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
    colorGroup = createPillGroup({ options: ["sárga", "zöld", "barna", "fekete", "vörös", "fehér-szürke"], value: poopColor, onChange: (v) => { poopColor = v; } });
    poopWrap.appendChild(colorGroup.el);
    poopWrap.appendChild(h("label", { text: "Állag", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", margin: "6px 0 4px" } }));
    textureGroup = createPillGroup({ options: ["pépes", "szilárd", "híg-vizes", "nyákos"], value: poopTexture, onChange: (v) => { poopTexture = v; } });
    poopWrap.appendChild(textureGroup.el);
    sheet.appendChild(poopWrap);

    function updatePoopVisibility() { poopWrap.style.display = diaperType === "pisi" ? "none" : ""; }
    updatePoopVisibility();

    const noteWrap = h("div", { className: "field" });
    noteWrap.appendChild(h("label", { text: "Jegyzet (opcionális)" }));
    noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.value = note || "";
    noteWrap.appendChild(noteInput);
    sheet.appendChild(noteWrap);
  }

  if (entry.type === "other") {
    sheet.appendChild(h("div", { className: "hint-box", text: entry.templateName }));
  }

  const deleteWarn = h("div");
  sheet.appendChild(deleteWarn);

  const actions = h("div", { className: "modal-actions" });
  const cancelBtn = h("button", { className: "btn btn-secondary", text: "Mégse", onClick: () => close() });
  const saveBtn = h("button", { className: "btn btn-primary", text: "Mentés" });
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Mentés…";
    try {
      if (entry.type === "feed") {
        await updateFeedingEntry(entry.id, { when, side, cantMeasure, wStart, wEnd, extraMilk, extraFormula });
      } else if (entry.type === "diaper") {
        await updateDiaperEntry(entry.id, { when, diaperType, poopColor, poopTexture, note: noteInput.value.trim() });
      } else {
        await updateCareLogEntry(entry.id, { when });
      }
      const historyEntries = await getHistoryEntries(babyId);
      backdrop.remove();
      setState({ historyEntries, historyEditing: null });
    } catch (e) {
      alert(e.message);
      saveBtn.disabled = false;
      saveBtn.textContent = "Mentés";
    }
  });
  actions.append(cancelBtn, saveBtn);
  sheet.appendChild(actions);

  const deleteBtn = h("button", { className: "modal-delete-btn" });
  deleteBtn.append(h("span", { text: "🗑" }), h("span", { text: "Bejegyzés törlése" }));
  deleteBtn.addEventListener("click", async () => {
    if (!confirmDelete) {
      confirmDelete = true;
      deleteBtn.classList.add("confirm");
      deleteBtn.lastChild.textContent = "Igen, törlöm";
      deleteWarn.innerHTML = "";
      deleteWarn.appendChild(h("div", { className: "modal-delete-warn" }, [
        h("span", { text: "⚠" }),
        h("span", { text: "Biztosan törlöd ezt a bejegyzést? Ez nem vonható vissza." }),
      ]));
      return;
    }
    deleteBtn.disabled = true;
    try {
      if (entry.type === "feed") await deleteFeedingEntry(entry.id);
      else if (entry.type === "diaper") await deleteDiaperEntry(entry.id);
      else await deleteCareLogEntry(entry.id);
      const historyEntries = await getHistoryEntries(babyId);
      backdrop.remove();
      setState({ historyEntries, historyEditing: null });
    } catch (e) {
      alert(e.message);
      deleteBtn.disabled = false;
    }
  });
  sheet.appendChild(deleteBtn);

  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
    setState({ historyEditing: null });
  }
}
