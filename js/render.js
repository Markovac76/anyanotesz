// DOM renderelés — build-eszköz nélküli, natív DOM-építő segédfüggvényekkel.
import { getState, setState } from "./state.js";
import { signIn, signUpAccount, approveRequest, rejectRequest } from "./auth.js";
import {
  enterSession, exitSession, refreshPendingRequests, switchActiveBaby, openHistory, openMaintenance,
  openUsers, openHelp, openAddBaby, closeAddBaby, handleAddBabyResult,
} from "./session.js";
import { buildWeightCard, buildFeedCard, buildDiaperCard, buildOtherCard, buildQuestionsCard } from "./function-cards.js";
import { buildHistoryPage } from "./history-page.js";
import { buildGraphsPage } from "./graphs-page.js";
import { buildMaintenancePage } from "./maintenance-page.js";
import { buildUsersPage } from "./users-page.js";
import { buildHelpPage } from "./help-page.js";
import { buildHeroCard } from "./hero-card.js";
import { renderBabyStepFlow } from "./baby-step-shared.js";
import { triggerUpdate, applyUpdate } from "./sw-update.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function makeInput({ label, type = "text", placeholder = "" }) {
  const wrap = h("div", { className: "field" });
  wrap.appendChild(h("label", { text: label }));
  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = type === "password" ? "current-password" : type === "email" ? "email" : "off";

  if (type !== "password") {
    wrap.appendChild(input);
    return { wrap, input };
  }

  // Jelszó "megmutatás" — alapból rejtett, koppintásra szövegként látszik
  // (elgépelés-ellenőrzéshez), újra koppintásra visszarejtve.
  const inputWrap = h("div", { className: "field-input-wrap" });
  const toggleBtn = h("button", { className: "password-toggle-btn", text: "👁" });
  toggleBtn.type = "button";
  toggleBtn.setAttribute("aria-label", "Jelszó megmutatása");
  toggleBtn.addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggleBtn.textContent = isHidden ? "🙈" : "👁";
    toggleBtn.setAttribute("aria-label", isHidden ? "Jelszó elrejtése" : "Jelszó megmutatása");
  });
  inputWrap.append(input, toggleBtn);
  wrap.appendChild(inputWrap);
  return { wrap, input };
}

export function renderApp() {
  const root = document.getElementById("app");
  root.innerHTML = "";
  const st = getState();

  if (st.status === "loading") root.appendChild(buildLoadingScreen());
  else if (st.status === "boot-error") root.appendChild(buildBootErrorScreen(st));
  else if (st.status === "auth") root.appendChild(buildAuthScreen());
  else if (st.status === "needs-baby") root.appendChild(buildBabyStepScreen());
  else if (st.status === "pending") root.appendChild(buildPendingScreen());
  else if (st.status === "dashboard") root.appendChild(buildDashboardScreen());

  // Az "Új verzió elérhető" sáv az aktuális képernyőtől függetlenül,
  // mindig a legfelül jelenik meg, amint a service worker jelzi.
  if (st.updateAvailable) root.appendChild(buildUpdateBanner());
}

function buildLoadingScreen() {
  return h("div", { className: "boot-loading", text: "Betöltés…" });
}

function buildBootErrorScreen(st) {
  const wrap = h("div", { className: "boot-loading boot-error-screen" });
  wrap.appendChild(h("div", { className: "boot-error-icon", text: "📡" }));
  wrap.appendChild(h("div", { className: "boot-error-text", text: st.bootError || "Nincs internetkapcsolat." }));
  const retryBtn = h("button", { className: "btn btn-primary", text: "Újrapróbálkozás", style: { maxWidth: "220px" } });
  retryBtn.addEventListener("click", () => window.location.reload());
  wrap.appendChild(retryBtn);
  return wrap;
}

function buildUpdateBanner() {
  const bar = h("div", { className: "update-banner" });
  bar.appendChild(h("span", { text: "Új verzió elérhető" }));
  const btn = h("button", { className: "update-banner-btn", text: "Frissítés" });
  btn.addEventListener("click", () => applyUpdate());
  bar.appendChild(btn);
  return bar;
}

// ---- Auth (bejelentkezés / regisztráció) ----

function buildAuthScreen() {
  const st = getState();
  const wrap = h("div", { className: "auth-wrap" });
  const card = h("div", { className: "auth-card" });
  card.appendChild(h("div", { className: "auth-logo", text: "Anyanotesz" }));
  card.appendChild(h("div", { className: "auth-sub", text: "Szoptatás- és baba-napló" }));

  const toggleRow = h("div", { className: "toggle-row" });
  const loginChip = h("button", {
    className: "toggle-chip" + (st.authMode === "login" ? " active" : ""),
    text: "Bejelentkezés",
    onClick: () => setState({ authMode: "login", authError: null }),
  });
  const registerChip = h("button", {
    className: "toggle-chip" + (st.authMode === "register" ? " active" : ""),
    text: "Regisztráció",
    onClick: () => setState({ authMode: "register", authError: null }),
  });
  toggleRow.append(loginChip, registerChip);
  card.appendChild(toggleRow);

  if (st.authError) card.appendChild(h("div", { className: "auth-error", text: st.authError }));

  card.appendChild(st.authMode === "login" ? buildLoginForm() : buildRegisterForm());

  wrap.appendChild(card);
  return wrap;
}

function buildLoginForm() {
  const form = h("div");
  const email = makeInput({ label: "Email", type: "email" });
  const password = makeInput({ label: "Jelszó", type: "password" });
  const submitBtn = h("button", { className: "btn btn-primary", text: "Bejelentkezés" });

  submitBtn.addEventListener("click", async () => {
    if (!email.input.value || !password.input.value) {
      setState({ authError: "Add meg az email címed és a jelszavad." });
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Bejelentkezés…";
    try {
      const session = await signIn(email.input.value.trim(), password.input.value);
      setState({ authError: null });
      await enterSession(session);
    } catch (e) {
      setState({ authError: mapAuthError(e) });
      submitBtn.disabled = false;
      submitBtn.textContent = "Bejelentkezés";
    }
  });

  form.append(email.wrap, password.wrap, submitBtn);
  return form;
}

function buildRegisterForm() {
  const form = h("div");
  const email = makeInput({ label: "Email", type: "email" });
  const password = makeInput({ label: "Jelszó", type: "password", placeholder: "legalább 6 karakter" });
  const submitBtn = h("button", { className: "btn btn-primary", text: "Regisztráció" });

  submitBtn.addEventListener("click", async () => {
    if (!email.input.value || !password.input.value) {
      setState({ authError: "Add meg az email címed és a jelszavad." });
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Regisztráció…";
    try {
      const { session, needsEmailConfirmation, alreadyRegistered } = await signUpAccount(email.input.value.trim(), password.input.value);
      setState({ authError: null });
      if (alreadyRegistered) {
        setState({
          authMode: "login",
          authError: "Ha ezzel az email címmel már van fiókod, jelentkezz be — ha elfelejtetted a jelszavad, egyelőre a régi jelszavaddal próbálkozz, jelszó-emlékeztető funkció még nincs az appban.",
        });
        return;
      }
      if (needsEmailConfirmation) {
        setState({
          authMode: "login",
          authError: "Erősítsd meg az email címed a kiküldött linkkel, utána jelentkezz be — a baba hozzáadását a bejelentkezés után kéri majd az app.",
        });
        return;
      }
      await enterSession(session);
    } catch (e) {
      setState({ authError: mapAuthError(e) });
      submitBtn.disabled = false;
      submitBtn.textContent = "Regisztráció";
    }
  });

  form.append(email.wrap, password.wrap, submitBtn);
  return form;
}

function mapAuthError(e) {
  const msg = e?.message || String(e);
  if (/invalid login credentials/i.test(msg)) return "Hibás email cím vagy jelszó.";
  if (/user already registered/i.test(msg)) return "Ezzel az email címmel már van regisztráció — jelentkezz be.";
  if (/email not confirmed/i.test(msg)) return "Még nem erősítetted meg az email címed — nézd meg a postafiókodat (és a spam mappát is), vagy kérj új megerősítő linket.";
  if (/password/i.test(msg) && /least/i.test(msg)) return "A jelszó túl rövid (legalább 6 karakter).";
  return msg;
}

// ---- Baba becenév lépés (regisztráció 2. fele / félbeszakadt regisztráció folytatása) ----

function buildBabyStepScreen() {
  const wrap = h("div", { className: "auth-wrap" });
  const card = h("div", { className: "auth-card" });
  card.appendChild(h("div", { className: "auth-logo", text: "Anyanotesz" }));
  card.appendChild(h("div", { className: "auth-sub", text: "Melyik babához tartozol?" }));

  const st = getState();
  renderBabyStepFlow({
    container: card,
    userId: st.session.user.id,
    onResult: async (result) => {
      if (result.status === "pending") setState({ status: "pending" });
      else await enterSession(st.session);
    },
  });

  wrap.appendChild(card);
  return wrap;
}

// ---- "Másik baba hozzáadása" — bejelentkezett állapotban, ha a usernek
// már van legalább egy jóváhagyott baba-tagsága (lásd session.js
// openAddBaby/handleAddBabyResult) ----

function buildAddBabyPage(st) {
  const wrap = h("div");

  const headRow = h("div", { className: "history-head-row" });
  const backBtn = h("button", { className: "back-btn", onClick: () => closeAddBaby() });
  backBtn.append(h("span", { text: "←" }), h("span", { text: "Vissza" }));
  headRow.append(backBtn, h("h2", { className: "history-title", text: "Másik baba hozzáadása" }));
  wrap.appendChild(headRow);

  const card = h("div", { className: "card" });
  renderBabyStepFlow({
    container: card,
    userId: st.session.user.id,
    onResult: (result) => handleAddBabyResult(result),
  });
  wrap.appendChild(card);

  return wrap;
}

// ---- Várakozás jóváhagyásra ----

function buildPendingScreen() {
  const wrap = h("div", { className: "pending-wrap" });
  const card = h("div", { className: "pending-card" });
  card.appendChild(h("div", { className: "pending-icon", text: "⏳" }));
  card.appendChild(h("div", { className: "pending-title", text: "Várakozás jóváhagyásra" }));
  card.appendChild(h("div", { className: "pending-text", text: "A csatlakozási kérelmedet még nem hagyta jóvá a baba egyik admin-ja sem. Amint jóváhagyja, itt automatikusan megjelenik az adatokhoz való hozzáférés." }));
  const logoutBtn = h("button", { className: "btn-link", text: "Kijelentkezés", style: { marginTop: "16px" } });
  logoutBtn.addEventListener("click", () => exitSession());
  card.appendChild(logoutBtn);
  wrap.appendChild(card);
  return wrap;
}

// ---- Dashboard (üres alapváz) ----

function buildIconBtn({ icon, label, emph, litUp, onClick }) {
  const className = "icon-btn" + (emph ? " emph" : "") + (litUp ? " update-ready" : "");
  const btn = h("button", { className, onClick });
  btn.appendChild(h("span", { text: icon, style: { fontSize: "17px" } }));
  btn.appendChild(h("span", { text: label }));
  return btn;
}

function buildDashboardScreen() {
  const st = getState();
  const shell = h("div", { className: "app-shell" });
  const hasBaby = !!st.activeBabyId;
  const isBabyAdmin = st.memberships.some((m) => m.role === "admin");

  const header = h("div", { className: "header" });
  const headerRow = h("div", { className: "header-row" });
  headerRow.appendChild(h("h1", { className: "header-title", text: "Anyanotesz" }));
  if (hasBaby) {
    headerRow.appendChild(buildIconBtn({
      icon: "🔧", label: "Karbant.",
      onClick: () => openMaintenance(st.activeBabyId),
    }));
  }
  headerRow.appendChild(buildIconBtn({
    icon: "🔄", label: "Frissítés",
    litUp: st.updateAvailable,
    onClick: () => triggerUpdate(),
  }));
  headerRow.appendChild(buildIconBtn({ icon: "❓", label: "Súgó", onClick: () => openHelp() }));

  if (st.isOwner || isBabyAdmin) {
    headerRow.appendChild(buildIconBtn({ icon: "👥", label: "Userek", emph: true, onClick: () => openUsers() }));
  }

  headerRow.appendChild(buildIconBtn({ icon: "🚪", label: "Kilépés", onClick: () => exitSession() }));
  header.appendChild(headerRow);

  header.appendChild(buildBabyBar(st));
  shell.appendChild(header);

  const existingInfoModal = document.getElementById("generic-info-modal");
  if (existingInfoModal) existingInfoModal.remove();
  if (st.infoModal) {
    const modal = buildInfoModal({
      title: st.infoModal.title,
      message: st.infoModal.message,
      onClose: () => setState({ infoModal: null }),
    });
    modal.id = "generic-info-modal";
    document.body.appendChild(modal);
  }

  const main = h("main");

  if (isBabyAdmin && st.pendingRequests.length > 0 && st.view === "dashboard") {
    main.appendChild(buildPendingRequestsCard(st));
  }

  if (st.view === "history") {
    main.appendChild(buildHistoryPage(st));
  } else if (st.view === "graphs") {
    main.appendChild(buildGraphsPage(st));
  } else if (st.view === "maintenance") {
    main.appendChild(buildMaintenancePage(st));
  } else if (st.view === "users") {
    main.appendChild(buildUsersPage(st));
  } else if (st.view === "help") {
    main.appendChild(buildHelpPage());
  } else if (st.view === "add-baby") {
    main.appendChild(buildAddBabyPage(st));
  } else if (hasBaby) {
    const hero = buildHeroCard(st);
    if (hero) main.appendChild(hero);
    main.appendChild(buildWeightCard(st));
    main.appendChild(buildFeedCard(st));
    main.appendChild(buildDiaperCard(st));
    main.appendChild(buildOtherCard(st));
    main.appendChild(buildQuestionsCard(st));
    main.appendChild(h("button", {
      className: "history-nav-btn",
      onClick: () => openHistory(st.activeBabyId),
    }, [h("span", { text: "📋" }), h("span", { text: "Historikus adatok" })]));
  }

  shell.appendChild(main);
  return shell;
}

// A baba-sáv mindig kattintható (nem csak 2+ tagságnál) — a lenyíló
// listában a "+ Másik baba hozzáadása" sor ekkor is elérhető, hogy egy
// eddig egy-babás user is fel tudjon venni/csatlakozni tudjon egy
// másodikhoz (pl. ikrek, második gyerek).
function buildBabyBar(st) {
  const activeMembership = st.memberships.find((m) => m.baby.id === st.activeBabyId) || st.memberships[0];
  const activeName = activeMembership?.baby?.nickname ?? "";

  const wrap = h("div", { className: "baby-picker" });
  const btn = h("button", { className: "baby-picker-btn" });
  btn.appendChild(h("span", { className: "baby-bar-name", text: activeName }));
  const hint = h("span", { className: "baby-picker-hint" });
  if (st.memberships.length > 1) hint.appendChild(h("span", { text: `${st.memberships.length} gyerek` }));
  hint.appendChild(h("span", { text: "⌄" }));
  btn.appendChild(hint);
  btn.addEventListener("click", () => setState({ babyPickerOpen: !st.babyPickerOpen }));
  wrap.appendChild(btn);

  if (st.babyPickerOpen) {
    const list = h("div", { className: "baby-picker-list" });
    st.memberships.forEach((m) => {
      const item = h("button", {
        className: "baby-picker-item" + (m.baby.id === st.activeBabyId ? " active" : ""),
        text: m.baby.nickname,
        onClick: () => switchActiveBaby(m.baby.id),
      });
      list.appendChild(item);
    });
    st.pendingMemberships.forEach((m) => {
      list.appendChild(h("div", {
        className: "baby-picker-item pending",
        text: `${m.baby.nickname} (várakozás jóváhagyásra)`,
      }));
    });
    list.appendChild(h("button", {
      className: "baby-picker-item add-baby",
      text: "+ Másik baba hozzáadása",
      onClick: () => openAddBaby(),
    }));
    wrap.appendChild(list);
  }

  return wrap;
}

function buildPendingRequestsCard(st) {
  const card = h("div", { className: "card" });
  const title = h("div", { className: "section-title" });
  title.appendChild(h("div", { className: "icon-chip", text: "👥", style: { background: "color-mix(in srgb, var(--pink) 22%, var(--panel))" } }));
  title.appendChild(h("h3", { text: "Függőben lévő kérelmek" }));
  card.appendChild(title);

  st.pendingRequests.forEach((req) => {
    const row = h("div", { className: "request-row" });
    const info = h("div", { className: "request-info" });
    info.innerHTML = `<b>${escapeHtml(req.baby?.nickname ?? "?")}</b>-hez szeretne csatlakozni<br>user: ${req.user_id.slice(0, 8)}…`;
    row.appendChild(info);

    const actions = h("div", { className: "request-actions" });
    const approveBtn = h("button", { className: "btn-approve", text: "Jóváhagy" });
    approveBtn.addEventListener("click", async () => {
      approveBtn.disabled = true;
      await approveRequest(req.baby_id, req.user_id, st.session.user.id);
      await refreshPendingRequests();
    });
    const rejectBtn = h("button", { className: "btn-reject", text: "Elutasít" });
    rejectBtn.addEventListener("click", async () => {
      rejectBtn.disabled = true;
      await rejectRequest(req.baby_id, req.user_id);
      await refreshPendingRequests();
    });
    actions.append(approveBtn, rejectBtn);
    row.appendChild(actions);
    card.appendChild(row);
  });

  return card;
}

function buildInfoModal({ title, message, onClose }) {
  const backdrop = h("div", { className: "modal-backdrop", style: { alignItems: "center" } });
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) onClose(); });
  const sheet = h("div", { className: "modal-sheet", style: { borderRadius: "20px", maxWidth: "380px" } });
  sheet.addEventListener("click", (e) => e.stopPropagation());
  sheet.appendChild(h("h4", { text: title, style: { marginBottom: "8px" } }));
  sheet.appendChild(h("p", { text: message, style: { fontSize: "13.5px", color: "var(--muted)", lineHeight: "1.5", marginBottom: "18px" } }));
  const okBtn = h("button", { className: "btn btn-primary", text: "OK", onClick: onClose });
  sheet.appendChild(okBtn);
  backdrop.appendChild(sheet);
  return backdrop;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
