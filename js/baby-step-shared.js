// Közös 3-lépéses "melyik babához tartozol" folyamat: becenév megadása →
// csatlakozás (meglévő baba) vagy létrehozás (új baba) megerősítése.
// Két hely használja: az első regisztráció (render.js buildBabyStepScreen)
// és a bejelentkezett állapotú "Másik baba hozzáadása" nézet (render.js
// buildAddBabyPage). A különbség köztük szándékosan NEM itt van — ez a
// függvény csak a lépések belső navigációját és a joinOrCreateBaby hívást
// kezeli, a köré rakott keretet (auth-card vs. dashboard-nézet) és az
// eredmény (onResult) feldolgozását a hívó adja meg.

import { findBabyByNickname } from "./data.js";
import { joinOrCreateBaby } from "./auth.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function makeTextInput(label, placeholder = "") {
  const wrap = h("div", { className: "field" });
  wrap.appendChild(h("label", { text: label }));
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  wrap.appendChild(input);
  return { wrap, input };
}

export function renderBabyStepFlow({ container, userId, onResult }) {
  const errorWrap = h("div");
  const stepArea = h("div");
  container.append(errorWrap, stepArea);

  function showError(msg) {
    errorWrap.innerHTML = "";
    if (msg) errorWrap.appendChild(h("div", { className: "auth-error", text: msg }));
  }

  const nickname = makeTextInput("Baba beceneve", "pl. Maci");

  function renderNicknameStep() {
    stepArea.innerHTML = "";
    stepArea.appendChild(h("div", {
      className: "field-hint",
      text: "Ha már van ilyen becenevű baba, csatlakozási kérelmet küldünk a babához tartozó admin(ok)nak. Ha nincs, te leszel az első tagja (és admin-ja).",
      style: { marginBottom: "12px" },
    }));
    stepArea.appendChild(nickname.wrap);

    const nextBtn = h("button", { className: "btn btn-primary", text: "Tovább" });
    nextBtn.addEventListener("click", async () => {
      const value = nickname.input.value.trim();
      if (!value) { showError("Add meg a baba becenevét."); return; }
      showError(null);
      nextBtn.disabled = true;
      nextBtn.textContent = "Keresés…";
      try {
        const existing = await findBabyByNickname(value);
        if (existing) renderConfirmJoinStep(value, existing);
        else renderConfirmCreateStep(value);
      } catch (e) {
        showError(e.message);
        nextBtn.disabled = false;
        nextBtn.textContent = "Tovább";
      }
    });
    stepArea.appendChild(nextBtn);
  }

  function renderConfirmJoinStep(nicknameValue, baby) {
    stepArea.innerHTML = "";
    stepArea.appendChild(h("div", {
      className: "auth-note",
      text: `Van már "${baby.nickname}" nevű baba a rendszerben${baby.full_name ? ` (${baby.full_name})` : ""}. A csatlakozásodat egy admin-nak jóvá kell hagynia.`,
    }));

    const backBtn = h("button", { className: "btn btn-secondary", text: "‹ Vissza", style: { marginBottom: "8px" } });
    backBtn.addEventListener("click", renderNicknameStep);

    const submitBtn = h("button", { className: "btn btn-primary", text: "Csatlakozási kérelem küldése" });
    submitBtn.addEventListener("click", async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = "Küldés…";
      try {
        const result = await joinOrCreateBaby({ userId, nickname: nicknameValue });
        await onResult(result);
      } catch (e) {
        showError(e.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Csatlakozási kérelem küldése";
      }
    });

    stepArea.append(backBtn, submitBtn);
  }

  function renderConfirmCreateStep(nicknameValue) {
    stepArea.innerHTML = "";
    stepArea.appendChild(h("div", {
      className: "auth-note",
      text: `Nincs még "${nicknameValue}" nevű baba — létrehozod, és automatikusan admin leszel.`,
    }));

    const fullName = makeTextInput("Baba teljes neve (opcionális)");
    stepArea.appendChild(fullName.wrap);

    const backBtn = h("button", { className: "btn btn-secondary", text: "‹ Vissza", style: { marginBottom: "8px" } });
    backBtn.addEventListener("click", renderNicknameStep);

    const submitBtn = h("button", { className: "btn btn-primary", text: "Baba létrehozása" });
    submitBtn.addEventListener("click", async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = "Létrehozás…";
      try {
        const result = await joinOrCreateBaby({ userId, nickname: nicknameValue, fullName: fullName.input.value });
        await onResult(result);
      } catch (e) {
        showError(e.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Baba létrehozása";
      }
    });

    stepArea.append(backBtn, submitBtn);
  }

  renderNicknameStep();
}
