// Karbantartás oldal — specifikacio.md 6.6: baba alapadatok szerkesztése,
// gyógyszer- és tevékenység-sablonok külön listaként, CRUD funkcióval.
// A demóban ez placeholder volt, saját vizuális referencia nélkül — a
// meglévő oldalak (Historikus, Grafikonok) elrendezését és komponenseit
// követi.

import { setState } from "./state.js";
import { createDateField, createTimeField } from "./datetime-picker.js";
import { createNumberField, createToggleGroup } from "./fields.js";
import { updateBaby, createCareTemplate, updateCareTemplate, deleteCareTemplate } from "./data.js";
import { closeMaintenance, refreshCareData } from "./session.js";
import { showInlineError } from "./ui-helpers.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function textField(label, value) {
  const wrap = h("div", { className: "field" });
  wrap.appendChild(h("label", { text: label }));
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  wrap.appendChild(input);
  return { wrap, input };
}

const FREQ_OPTIONS = [{ key: "daily", label: "Napi" }, { key: "weekly", label: "Heti" }, { key: "monthly", label: "Havi" }];
const FREQ_LABEL = { daily: "Napi", weekly: "Heti", monthly: "Havi" };

export function buildMaintenancePage(st) {
  const wrap = h("div");

  const headRow = h("div", { className: "history-head-row" });
  const backBtn = h("button", { className: "back-btn", onClick: () => closeMaintenance() });
  backBtn.append(h("span", { text: "←" }), h("span", { text: "Vissza" }));
  headRow.append(backBtn, h("h2", { className: "history-title", text: "Karbantartás" }));
  wrap.appendChild(headRow);

  if (!st.maintenanceBaby) {
    wrap.appendChild(h("div", { className: "hint-box", text: "Betöltés…" }));
    return wrap;
  }

  wrap.appendChild(buildBabyEditCard(st));
  wrap.appendChild(buildTemplateListCard({
    title: "Gyógyszer sablonok", icon: "💊", color: "var(--pink)", category: "medication",
    templates: st.careTemplates.filter((t) => t.category === "medication"),
    babyId: st.activeBabyId,
  }));
  wrap.appendChild(buildTemplateListCard({
    title: "Tevékenység sablonok", icon: "🧸", color: "var(--accent)", category: "activity",
    templates: st.careTemplates.filter((t) => t.category === "activity"),
    babyId: st.activeBabyId,
  }));

  return wrap;
}

// ---- Baba alapadatai ----

function buildBabyEditCard(st) {
  const baby = st.maintenanceBaby;
  const card = h("div", { className: "card" });
  card.appendChild(h("h3", { text: "Baba alapadatai", style: { fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "700", margin: "0 0 12px" } }));

  const nickname = textField("Becenév", baby.nickname);
  card.appendChild(nickname.wrap);
  const fullName = textField("Teljes név", baby.full_name);
  card.appendChild(fullName.wrap);

  let bornAt = baby.born_at ? new Date(baby.born_at) : new Date();
  const dateField = createDateField({ label: "Születés dátuma", value: bornAt, onChange: (d) => { bornAt = d; timeField.setValue(d); } });
  const timeField = createTimeField({ label: "Születés ideje", value: bornAt, onChange: (d) => { bornAt = d; dateField.setValue(d); } });
  card.appendChild(h("div", { className: "grid-2" }, [dateField.el, timeField.el]));

  const place = textField("Születési hely", baby.birth_place);
  card.appendChild(place.wrap);

  const weightField = createNumberField({ label: "Születési súly", unit: "g", value: baby.birth_weight_g != null ? String(baby.birth_weight_g) : "" });
  const lengthField = createNumberField({ label: "Születési hossz", unit: "cm", value: baby.birth_length_cm != null ? String(baby.birth_length_cm) : "" });
  card.appendChild(h("div", { className: "grid-2" }, [weightField.el, lengthField.el]));

  const targetField = createNumberField({ label: "Heti gyarapodási cél", unit: "g/hét", value: baby.weekly_gain_target_g != null ? String(baby.weekly_gain_target_g) : "" });
  card.appendChild(targetField.el);

  const status = h("div", { className: "save-status" });
  const saveBtn = h("button", { className: "btn btn-primary", text: "Mentés", style: { marginTop: "2px" } });
  saveBtn.addEventListener("click", async () => {
    const nicknameValue = nickname.input.value.trim();
    if (!nicknameValue) {
      status.textContent = "A becenév kötelező.";
      status.className = "save-status error";
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Mentés…";
    status.textContent = "";
    status.className = "save-status";
    try {
      const updated = await updateBaby(baby.id, {
        nickname: nicknameValue,
        full_name: fullName.input.value.trim() || null,
        born_at: bornAt.toISOString(),
        birth_place: place.input.value.trim() || null,
        birth_weight_g: weightField.getValue() ? parseInt(weightField.getValue(), 10) : null,
        birth_length_cm: lengthField.getValue() ? parseFloat(lengthField.getValue()) : null,
        weekly_gain_target_g: targetField.getValue() ? parseInt(targetField.getValue(), 10) : 150,
      });
      const memberships = st.memberships.map((m) => (
        m.baby.id === baby.id ? { ...m, baby: { ...m.baby, nickname: updated.nickname, full_name: updated.full_name } } : m
      ));
      // A gyerek-doboz (dashboard) is ugyanezt a baba-rekordot mutatja —
      // frissítjük, hogy a Karbantartásból visszalépve azonnal a friss
      // adatokat (születési adatok, heti cél) lássa, ne kelljen újratöltés.
      const babyInfo = st.babyInfo ? { ...st.babyInfo, baby: updated } : st.babyInfo;
      setState({ memberships, maintenanceBaby: updated, babyInfo });
      status.textContent = "Mentve ✓";
      status.className = "save-status success";
    } catch (e) {
      status.textContent = e.message;
      status.className = "save-status error";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Mentés";
    }
  });
  card.append(saveBtn, status);

  return card;
}

// ---- Gyógyszer / tevékenység sablonok ----

function buildTemplateListCard({ title, icon, color, category, templates, babyId }) {
  const card = h("div", { className: "card" });
  card.appendChild(h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" } }, [
    h("div", { className: "coll-icon-chip", text: icon, style: { background: `color-mix(in srgb, ${color} 22%, var(--panel))`, color } }),
    h("h3", { text: title, style: { fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "700", margin: 0 } }),
  ]));

  const listWrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" } });
  let expandedId = null;

  function renderList() {
    listWrap.innerHTML = "";
    if (templates.length === 0) {
      listWrap.appendChild(h("div", { className: "hint-box", text: "Még nincs ilyen sablon.", style: { marginBottom: 0 } }));
      return;
    }
    templates.forEach((t) => listWrap.appendChild(buildRow(t)));
  }

  function buildRow(t) {
    const row = h("div", { className: "question-row" });
    const isOpen = expandedId === t.id;

    const head = h("button", { className: "question-head" });
    head.appendChild(h("span", { className: "question-text", text: t.name }));
    head.appendChild(h("span", { className: "care-freq", text: FREQ_LABEL[t.frequency], style: { flexShrink: 0 } }));
    head.appendChild(h("span", { className: "coll-chevron" + (isOpen ? " open" : ""), text: "⌄" }));
    head.addEventListener("click", () => { expandedId = isOpen ? null : t.id; renderList(); });
    row.appendChild(head);

    if (isOpen) row.appendChild(buildEditDetail(t));
    return row;
  }

  function buildEditDetail(t) {
    const detail = h("div", { className: "question-detail" });

    const name = textField("Név", t.name);
    detail.appendChild(name.wrap);

    detail.appendChild(h("label", { text: "Gyakoriság", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
    const freqGroup = createToggleGroup({ options: FREQ_OPTIONS, value: t.frequency, color, onChange: () => {} });
    detail.appendChild(h("div", { style: { marginBottom: "10px" } }, [freqGroup.el]));

    const status = h("div", { className: "save-status" });
    const actions = h("div", { className: "modal-actions" });
    const cancelBtn = h("button", { className: "btn btn-secondary", text: "Mégse", onClick: () => { expandedId = null; renderList(); } });
    const saveBtn = h("button", { className: "btn btn-primary", text: "Mentés" });
    saveBtn.addEventListener("click", async () => {
      const nameValue = name.input.value.trim();
      if (!nameValue) {
        status.textContent = "A név kötelező.";
        status.className = "save-status error";
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "Mentés…";
      try {
        await updateCareTemplate(t.id, { name: nameValue, frequency: freqGroup.getValue() });
        await refreshCareData(babyId);
      } catch (e) {
        status.textContent = e.message;
        status.className = "save-status error";
        saveBtn.disabled = false;
        saveBtn.textContent = "Mentés";
      }
    });
    actions.append(cancelBtn, saveBtn);
    detail.appendChild(actions);
    detail.appendChild(status);

    let confirmDelete = false;
    const deleteWarn = h("div");
    const deleteBtn = h("button", { className: "modal-delete-btn" });
    deleteBtn.append(h("span", { text: "🗑" }), h("span", { text: "Sablon törlése" }));
    deleteBtn.addEventListener("click", async () => {
      if (!confirmDelete) {
        confirmDelete = true;
        deleteBtn.classList.add("confirm");
        deleteBtn.lastChild.textContent = "Igen, törlöm";
        deleteWarn.innerHTML = "";
        deleteWarn.appendChild(h("div", { className: "modal-delete-warn" }, [
          h("span", { text: "⚠" }),
          h("span", { text: "Biztosan törlöd? A hozzá tartozó historikus naplózások is elvesznek. Ez nem vonható vissza." }),
        ]));
        return;
      }
      deleteBtn.disabled = true;
      try {
        await deleteCareTemplate(t.id);
        await refreshCareData(babyId);
      } catch (e) {
        showInlineError(deleteWarn, e.message);
        deleteBtn.disabled = false;
      }
    });
    detail.appendChild(deleteWarn);
    detail.appendChild(deleteBtn);

    return detail;
  }

  renderList();
  card.appendChild(listWrap);

  const addWrap = h("div");
  const newName = textField("Új sablon neve", "");
  newName.input.placeholder = "pl. Orrszívás";
  addWrap.appendChild(newName.wrap);

  addWrap.appendChild(h("label", { text: "Gyakoriság", style: { display: "block", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" } }));
  let newFrequency = "daily";
  const newFreqGroup = createToggleGroup({ options: FREQ_OPTIONS, value: newFrequency, color, onChange: (v) => { newFrequency = v; } });
  addWrap.appendChild(h("div", { style: { marginBottom: "10px" } }, [newFreqGroup.el]));

  const addStatus = h("div", { className: "save-status" });
  const addBtn = h("button", { className: "btn btn-secondary", text: "+ Sablon hozzáadása" });
  addBtn.addEventListener("click", async () => {
    const nameValue = newName.input.value.trim();
    if (!nameValue) {
      addStatus.textContent = "Adj meg egy nevet.";
      addStatus.className = "save-status error";
      return;
    }
    addBtn.disabled = true;
    try {
      await createCareTemplate({ babyId, name: nameValue, frequency: newFrequency, category });
      await refreshCareData(babyId);
    } catch (e) {
      addStatus.textContent = e.message;
      addStatus.className = "save-status error";
      addBtn.disabled = false;
    }
  });
  addWrap.append(addBtn, addStatus);
  card.appendChild(addWrap);

  return card;
}
