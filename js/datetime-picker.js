// Dátum- és időválasztó komponensek — a demó (anyanotesz-demo.jsx) Calendar +
// TimeWheel + DateField/TimeField mintáinak natív ES-modul / vanilla DOM portja.
// Egykezes használatra: nagy gombok, saját naptár és görgethető óra:perc választó,
// natív billentyűzet/dátumpicker nélkül.

const HU_MONTHS = ["jan", "febr", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"];
const HU_DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtDateTime(d) {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const datePart = isToday ? "ma" : `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.`;
  return `${datePart} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isEarlierThanNow(d) {
  return d.getTime() < Date.now() - 60000; // 1 percnél nagyobb eltérés a múltba
}

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

// ---- Görgethető szám-oszlop (óra / perc) ----
function buildWheelColumn({ values, initial, onChange, itemH = 40, visible = 5 }) {
  const padCount = Math.floor(visible / 2);
  const col = h("div", { className: "wheel-col", style: { height: `${itemH * visible}px` } });
  const highlight = h("div", {
    className: "wheel-col-highlight",
    style: { top: `${itemH * padCount}px`, height: `${itemH}px` },
  });
  const fadeTop = h("div", { className: "wheel-col-fade top", style: { height: `${itemH * padCount}px` } });
  const fadeBottom = h("div", { className: "wheel-col-fade bottom", style: { height: `${itemH * padCount}px` } });
  const scroll = h("div", {
    className: "wheel-col-scroll no-scrollbar",
    style: { paddingTop: `${itemH * padCount}px`, paddingBottom: `${itemH * padCount}px` },
  });

  const itemEls = values.map((v) => {
    const item = h("div", { className: "wheel-item", text: pad(v), style: { height: `${itemH}px`, scrollSnapAlign: "center" } });
    item.addEventListener("click", () => onChange(v));
    scroll.appendChild(item);
    return item;
  });

  let scrolling = false;
  let timeoutId = null;
  scroll.addEventListener("scroll", () => {
    scrolling = true;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const idx = Math.round(scroll.scrollTop / itemH);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      scroll.scrollTo({ top: clamped * itemH, behavior: "smooth" });
      onChange(values[clamped]);
      scrolling = false;
    }, 90);
  });

  col.append(highlight, fadeTop, fadeBottom, scroll);

  function setValue(value) {
    itemEls.forEach((item, i) => {
      const active = values[i] === value;
      item.classList.toggle("active", active);
    });
    const idx = values.indexOf(value);
    if (idx >= 0 && !scrolling) scroll.scrollTop = idx * itemH;
  }

  setValue(initial);
  return { el: col, setValue };
}

function buildTimeWheel({ hour, minute, onChange }) {
  const wrap = h("div", { className: "wheel-wrap" });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  let h_ = hour;
  let m_ = minute;

  const hourCol = buildWheelColumn({
    values: hours,
    initial: hour,
    onChange: (v) => { h_ = v; hourCol.setValue(h_); onChange(h_, m_); },
  });
  const colon = h("div", { className: "wheel-colon", text: ":" });
  const minuteCol = buildWheelColumn({
    values: minutes,
    initial: minute,
    onChange: (v) => { m_ = v; minuteCol.setValue(m_); onChange(h_, m_); },
  });

  wrap.append(hourCol.el, colon, minuteCol.el);
  return {
    el: wrap,
    setValue(hh, mm) { h_ = hh; m_ = mm; hourCol.setValue(h_); minuteCol.setValue(m_); },
  };
}

// ---- Naptár (dátumválasztó) ----
function buildCalendar({ selected, onSelect }) {
  let viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  let currentSelected = selected;
  const wrap = h("div");

  function render() {
    wrap.innerHTML = "";

    const head = h("div", { className: "cal-head" });
    const prevBtn = h("button", {
      text: "‹",
      onClick: () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1); render(); },
    });
    const label = h("div", { className: "cal-month-label", text: `${viewMonth.getFullYear()}. ${HU_MONTHS[viewMonth.getMonth()]}` });
    const nextBtn = h("button", {
      text: "›",
      onClick: () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1); render(); },
    });
    head.append(prevBtn, label, nextBtn);
    wrap.appendChild(head);

    const dowRow = h("div", { className: "cal-grid" });
    HU_DAYS.forEach((d) => dowRow.appendChild(h("div", { className: "cal-dow", text: d })));
    wrap.appendChild(dowRow);

    const grid = h("div", { className: "cal-grid" });
    const firstWeekday = (viewMonth.getDay() + 6) % 7; // hétfő=0
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const now = new Date();

    for (let i = 0; i < firstWeekday; i++) grid.appendChild(h("div"));
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const isSelected = d.toDateString() === currentSelected.toDateString();
      const isToday = d.toDateString() === now.toDateString();
      const cls = "cal-day" + (isSelected ? " selected" : "") + (isToday && !isSelected ? " today" : "");
      grid.appendChild(h("button", { className: cls, text: String(day), onClick: () => onSelect(d) }));
    }
    wrap.appendChild(grid);
  }

  render();
  return {
    el: wrap,
    setSelected(d) { currentSelected = d; viewMonth = new Date(d.getFullYear(), d.getMonth(), 1); render(); },
  };
}

// ---- Közös bottom-sheet modal ----
function openBottomSheet({ title, onNow, onCancel, onApply, buildBody }) {
  const backdrop = h("div", { className: "modal-backdrop" });
  const sheet = h("div", { className: "modal-sheet" });
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) onCancel(); });
  sheet.addEventListener("click", (e) => e.stopPropagation());

  const headEl = h("div", { className: "modal-head" });
  const titleEl = h("h4", { text: title });
  const nowBtn = h("button", { className: "dt-quick-btn", text: "Most", onClick: onNow });
  headEl.append(titleEl, nowBtn);
  sheet.appendChild(headEl);

  const bodyWrap = h("div");
  sheet.appendChild(bodyWrap);

  const warnWrap = h("div");
  sheet.appendChild(warnWrap);

  const actions = h("div", { className: "modal-actions" });
  const cancelBtn = h("button", { className: "btn btn-secondary", text: "Mégse", onClick: onCancel });
  const applyBtn = h("button", { className: "btn btn-primary", text: "Kész", onClick: () => onApply() });
  actions.append(cancelBtn, applyBtn);
  sheet.appendChild(actions);

  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  buildBody(bodyWrap);

  function setConfirmPast(isPast, tempLabel) {
    warnWrap.innerHTML = "";
    if (isPast) {
      const warn = h("div", { className: "confirm-past" });
      warn.appendChild(h("span", { text: "⚠" }));
      warn.appendChild(h("span", { text: `Ez egy korábbi időpont (${tempLabel}), nem a mostani. Biztosan ezt szeretnéd rögzíteni?` }));
      warnWrap.appendChild(warn);
      applyBtn.textContent = "Igen, ezt rögzítem";
      applyBtn.style.background = "var(--amber)";
    } else {
      applyBtn.textContent = "Kész";
      applyBtn.style.background = "";
    }
  }

  function close() {
    backdrop.remove();
  }

  return { close, setConfirmPast };
}

// ---- Dátum mező ----
export function createDateField({ label, value, onChange }) {
  let current = value;
  const wrap = h("div", { className: "dt-field" });

  const headRow = h("div", { className: "dt-field-head" });
  const labelEl = h("label", { text: label });
  const todayBtn = h("button", { className: "dt-quick-btn", text: "Ma" });
  headRow.append(labelEl, todayBtn);

  const openBtn = h("button", { className: "dt-field-btn" });
  const valueSpan = h("span");
  openBtn.appendChild(valueSpan);
  openBtn.appendChild(h("span", { text: "▾", style: { color: "var(--faint)" } }));

  wrap.append(headRow, openBtn);

  function renderValue() {
    valueSpan.textContent = `${current.getFullYear()}.${pad(current.getMonth() + 1)}.${pad(current.getDate())}.`;
  }
  renderValue();

  todayBtn.addEventListener("click", () => {
    const now = new Date();
    current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), current.getHours(), current.getMinutes());
    renderValue();
    onChange(current);
  });

  openBtn.addEventListener("click", () => {
    let temp = current;
    let calendar;

    const sheet = openBottomSheet({
      title: label,
      onNow: () => {
        const now = new Date();
        temp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), temp.getHours(), temp.getMinutes());
        calendar.setSelected(temp);
        sheet.setConfirmPast(false);
      },
      onCancel: () => sheet.close(),
      onApply: () => {
        if (isEarlierThanNow(temp) && !applied) {
          applied = true;
          sheet.setConfirmPast(true, fmtDateTime(temp));
          return;
        }
        current = temp;
        renderValue();
        onChange(current);
        sheet.close();
      },
      buildBody: (bodyWrap) => {
        calendar = buildCalendar({
          selected: temp,
          onSelect: (d) => {
            temp = new Date(d.getFullYear(), d.getMonth(), d.getDate(), temp.getHours(), temp.getMinutes());
            calendar.setSelected(temp);
            applied = false;
            sheet.setConfirmPast(false);
          },
        });
        bodyWrap.appendChild(calendar.el);
      },
    });
    let applied = false;
  });

  return { el: wrap, setValue(d) { current = d; renderValue(); } };
}

// ---- Idő mező (görgethető óra) ----
export function createTimeField({ label, value, onChange }) {
  let current = value;
  const wrap = h("div", { className: "dt-field" });

  const headRow = h("div", { className: "dt-field-head" });
  const labelEl = h("label", { text: label });
  const nowBtn = h("button", { className: "dt-quick-btn", text: "Most" });
  headRow.append(labelEl, nowBtn);

  const openBtn = h("button", { className: "dt-field-btn" });
  const valueSpan = h("span");
  openBtn.appendChild(valueSpan);
  openBtn.appendChild(h("span", { text: "🕐", style: { color: "var(--faint)", fontSize: "13px" } }));

  wrap.append(headRow, openBtn);

  function renderValue() {
    valueSpan.textContent = `${pad(current.getHours())}:${pad(current.getMinutes())}`;
  }
  renderValue();

  nowBtn.addEventListener("click", () => {
    const now = new Date();
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate(), now.getHours(), now.getMinutes());
    renderValue();
    onChange(current);
  });

  openBtn.addEventListener("click", () => {
    let temp = current;
    let wheel;
    let applied = false;

    const sheet = openBottomSheet({
      title: label,
      onNow: () => {
        const now = new Date();
        temp = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), now.getHours(), now.getMinutes());
        wheel.setValue(temp.getHours(), temp.getMinutes());
        applied = false;
        sheet.setConfirmPast(false);
      },
      onCancel: () => sheet.close(),
      onApply: () => {
        if (isEarlierThanNow(temp) && !applied) {
          applied = true;
          sheet.setConfirmPast(true, fmtDateTime(temp));
          return;
        }
        current = temp;
        renderValue();
        onChange(current);
        sheet.close();
      },
      buildBody: (bodyWrap) => {
        wheel = buildTimeWheel({
          hour: temp.getHours(),
          minute: temp.getMinutes(),
          onChange: (hh, mm) => {
            temp = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), hh, mm);
            applied = false;
            sheet.setConfirmPast(false);
          },
        });
        bodyWrap.appendChild(wheel.el);
      },
    });
  });

  return { el: wrap, setValue(d) { current = d; renderValue(); } };
}
