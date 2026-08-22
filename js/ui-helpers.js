// Egységes, inline hibamegjelenítés — alert() helyett használjuk mindenhol,
// hogy a felhasználó ne egy natív böngésző-popupot lásson, hanem a felület
// részeként, konzisztens stílusban jelenjen meg a hiba.

export function showInlineError(container, message) {
  let el = container.querySelector(":scope > .inline-error");
  if (!el) {
    el = document.createElement("div");
    el.className = "inline-error";
    container.appendChild(el);
  }
  el.textContent = message;
}

export function clearInlineError(container) {
  const el = container.querySelector(":scope > .inline-error");
  if (el) el.remove();
}
