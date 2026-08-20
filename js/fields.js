// Közös bevitel-komponensek a funkció-dobozokhoz — a demó (anyanotesz-demo.jsx)
// NumberField / ToggleChip / pill-választó mintáinak natív ES-modul portja.
// Egykezes használatra: saját felugró számbillentyűzet, nagy koppintható chipek.

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

// ---- Szám-beviteli mező felugró számbillentyűzettel ----
export function createNumberField({ label, value = "", unit, placeholder, onChange }) {
  let current = value;
  const wrap = h("div", { className: "num-field" });
  wrap.appendChild(h("label", { text: label }));

  const btn = h("button", { className: "num-field-btn" });
  const valueSpan = h("span");
  btn.appendChild(valueSpan);
  wrap.appendChild(btn);

  function renderValue() {
    valueSpan.textContent = current ? `${current}${unit ? " " + unit : ""}` : placeholder || "0";
    valueSpan.style.color = current ? "var(--ink)" : "var(--faint)";
  }
  renderValue();

  btn.addEventListener("click", () => {
    let temp = current;

    const backdrop = h("div", { className: "modal-backdrop" });
    const sheet = h("div", { className: "modal-sheet" });
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    sheet.addEventListener("click", (e) => e.stopPropagation());

    const headEl = h("div", { className: "modal-head" });
    headEl.appendChild(h("h4", { text: label }));
    const clearBtn = h("button", { className: "dt-quick-btn", text: "Törlés", onClick: () => { temp = ""; renderDisplay(); } });
    headEl.appendChild(clearBtn);
    sheet.appendChild(headEl);

    const display = h("div", { className: "keypad-display" });
    const displayValue = h("span", { text: "0" });
    display.appendChild(displayValue);
    let unitSpan = null;
    if (unit) {
      unitSpan = h("span", { text: unit, style: { fontSize: "16px", fontWeight: "600", color: "var(--faint)", marginLeft: "6px" } });
      display.appendChild(unitSpan);
    }
    sheet.appendChild(display);

    function renderDisplay() { displayValue.textContent = temp || "0"; }
    renderDisplay();

    const grid = h("div", { className: "keypad-grid" });
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
    keys.forEach((k) => {
      const key = h("button", {
        className: "keypad-key",
        text: k === "back" ? "⌫" : k === "clear" ? "C" : k,
        onClick: () => {
          if (k === "back") temp = temp.slice(0, -1);
          else if (k === "clear") temp = "";
          else if (temp.length < 5) temp += k;
          renderDisplay();
        },
      });
      grid.appendChild(key);
    });
    sheet.appendChild(grid);

    const actions = h("div", { className: "modal-actions" });
    const cancelBtn = h("button", { className: "btn btn-secondary", text: "Mégse", onClick: () => close() });
    const applyBtn = h("button", {
      className: "btn btn-primary", text: "Kész",
      onClick: () => { current = temp; renderValue(); onChange?.(current); close(); },
    });
    actions.append(cancelBtn, applyBtn);
    sheet.appendChild(actions);

    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    function close() { backdrop.remove(); }
  });

  return {
    el: wrap,
    getValue: () => current,
    setValue(v) { current = v; renderValue(); },
  };
}

// ---- Vízszintes választó-chip csoport (pl. Bal/Jobb/Mindkettő, Pisi/Kaki/Mindkettő) ----
export function createToggleGroup({ options, value, color, onChange }) {
  let current = value;
  const wrap = h("div", { className: "toggle-row", style: { marginBottom: 0 } });
  const buttons = {};

  options.forEach((opt) => {
    const btn = h("button", { className: "toggle-chip", text: opt.label });
    if (color) btn.style.setProperty("--chip-color", color);
    btn.addEventListener("click", () => {
      current = opt.key;
      updateActive();
      onChange?.(current);
    });
    buttons[opt.key] = btn;
    wrap.appendChild(btn);
  });

  function updateActive() {
    Object.entries(buttons).forEach(([k, b]) => b.classList.toggle("active", k === current));
  }
  updateActive();

  return {
    el: wrap,
    getValue: () => current,
    setValue(v) { current = v; updateActive(); },
  };
}

// ---- Kerek pill-választó csoport, több sorba törhet (pl. kaki szín/állag) ----
export function createPillGroup({ options, value, onChange }) {
  let current = value;
  const wrap = h("div", { className: "pill-row" });
  const buttons = {};

  options.forEach((opt) => {
    const btn = h("button", { className: "pill", text: opt });
    btn.addEventListener("click", () => {
      current = opt;
      updateActive();
      onChange?.(current);
    });
    buttons[opt] = btn;
    wrap.appendChild(btn);
  });

  function updateActive() {
    Object.entries(buttons).forEach(([k, b]) => b.classList.toggle("active", k === current));
  }
  updateActive();

  return {
    el: wrap,
    getValue: () => current,
    setValue(v) { current = v; updateActive(); },
  };
}
