// "Userek" oldal — a fejléc 👥 gombja mögötti felület.
//
// Két, egymástól élesen elváló nézet van itt:
// - "Saját babák": a bejelentkezett user által adminisztrált babák
//   függőben lévő kérelmei + tagjai, jóváhagyás/elutasítás/adminná-léptetés
//   gombokkal (a korábbi, dashboardon inline mutatott kártya teljes,
//   önálló változata).
// - "Minden felhasználó (Owner nézet)": kizárólag a globális owner-nek —
//   az összes baba listázva a tagjaival, admin nélkül maradt babák piros
//   jelzéssel + vészhelyzeti admin-kijelölés/baba-törlés gombokkal.
//
// Ha a user egyszerre owner ÉS admin is valahol (mint most nálad), egy
// fül-váltó dönti el, melyik nézet látszik — egyébként csak az egyik.

import { getState, setState } from "./state.js";
import { closeUsers, openUsers, refreshPendingRequests, enterSession } from "./session.js";
import { approveRequest, rejectRequest } from "./auth.js";
import { promoteToAdmin, demoteToUser, leaveBaby, deleteBaby } from "./data.js";

function h(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

function shortId(userId) {
  return userId.slice(0, 8) + "…";
}

async function reloadAfterMembershipChange() {
  const st = getState();
  await enterSession(st.session);
  await openUsers();
}

export function buildUsersPage(st) {
  const wrap = h("div");

  const headRow = h("div", { className: "history-head-row" });
  if (st.activeBabyId) {
    const backBtn = h("button", { className: "back-btn", onClick: () => closeUsers() });
    backBtn.append(h("span", { text: "←" }), h("span", { text: "Vissza" }));
    headRow.appendChild(backBtn);
  }
  headRow.appendChild(h("h2", { className: "history-title", text: "Userek" }));
  wrap.appendChild(headRow);

  const isBabyAdmin = st.memberships.some((m) => m.role === "admin");
  const showTabs = st.isOwner && isBabyAdmin;

  if (showTabs) {
    const toggleRow = h("div", { className: "toggle-row" });
    const ownChip = h("button", {
      className: "toggle-chip" + (st.usersOverviewTab === "own" ? " active" : ""),
      text: "Saját babák",
      onClick: () => setState({ usersOverviewTab: "own" }),
    });
    const ownerChip = h("button", {
      className: "toggle-chip" + (st.usersOverviewTab === "owner" ? " active" : ""),
      text: "Minden felhasználó (Owner nézet)",
      onClick: () => setState({ usersOverviewTab: "owner" }),
    });
    toggleRow.append(ownChip, ownerChip);
    wrap.appendChild(toggleRow);
  }

  const tab = showTabs ? st.usersOverviewTab : (st.isOwner ? "owner" : "own");

  if (!st.usersOverview) {
    wrap.appendChild(h("div", { className: "hint-box", text: "Betöltés…" }));
    return wrap;
  }

  wrap.appendChild(tab === "owner" ? buildOwnerOverview(st) : buildOwnBabiesView(st));
  return wrap;
}

// ---- "Saját babák" nézet ----

function buildOwnBabiesView(st) {
  const container = h("div");
  const adminBabyIds = new Set(st.memberships.filter((m) => m.role === "admin").map((m) => m.baby.id));

  if (adminBabyIds.size === 0) {
    container.appendChild(h("div", { className: "hint-box", text: "Egyik babánál sem vagy admin, ezért itt nincs mit kezelned." }));
    return container;
  }

  for (const babyId of adminBabyIds) {
    const overview = st.usersOverview.find((b) => b.id === babyId);
    if (!overview) continue;
    container.appendChild(buildBabyManageCard(st, overview));
  }

  return container;
}

function buildBabyManageCard(st, overview) {
  const card = h("div", { className: "card" });
  card.appendChild(h("h3", {
    text: overview.nickname,
    style: { fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "700", margin: "0 0 12px" },
  }));

  const pending = st.pendingRequests.filter((r) => r.baby_id === overview.id);
  const approvedMembers = (overview.baby_members || []).filter((m) => m.status === "approved");
  const adminCount = approvedMembers.filter((m) => m.role === "admin").length;

  if (pending.length > 0) {
    card.appendChild(h("div", { className: "section-title", style: { marginTop: 0 } }, [
      h("h3", { text: "Függőben lévő kérelmek", style: { fontSize: "13px" } }),
    ]));
    pending.forEach((req) => {
      const row = h("div", { className: "request-row" });
      row.appendChild(h("div", { className: "request-info", text: `user: ${shortId(req.user_id)}` }));
      const actions = h("div", { className: "request-actions" });
      const approveBtn = h("button", { className: "btn-approve", text: "Jóváhagy" });
      approveBtn.addEventListener("click", async () => {
        approveBtn.disabled = true;
        await approveRequest(req.baby_id, req.user_id, st.session.user.id);
        await refreshPendingRequests();
        await openUsers();
      });
      const rejectBtn = h("button", { className: "btn-reject", text: "Elutasít" });
      rejectBtn.addEventListener("click", async () => {
        rejectBtn.disabled = true;
        await rejectRequest(req.baby_id, req.user_id);
        await refreshPendingRequests();
        await openUsers();
      });
      actions.append(approveBtn, rejectBtn);
      row.appendChild(actions);
      card.appendChild(row);
    });
  }

  card.appendChild(h("div", { className: "section-title" }, [
    h("h3", { text: "Tagok", style: { fontSize: "13px" } }),
  ]));

  approvedMembers.forEach((m) => {
    const row = h("div", { className: "request-row" });
    const isMe = m.user_id === st.session.user.id;
    row.appendChild(h("div", { className: "request-info" }, [
      h("span", {}, [document.createTextNode(isMe ? "Te" : shortId(m.user_id))]),
      h("span", { text: m.role === "admin" ? " — admin" : " — user", style: { color: "var(--muted)" } }),
    ]));

    const actions = h("div", { className: "request-actions" });

    if (m.role === "user") {
      const promoteBtn = h("button", { className: "btn-approve", text: "Adminná léptet" });
      promoteBtn.addEventListener("click", async () => {
        promoteBtn.disabled = true;
        await promoteToAdmin(overview.id, m.user_id);
        await reloadAfterMembershipChange();
      });
      actions.appendChild(promoteBtn);
    }

    if (isMe && m.role === "admin") {
      actions.appendChild(buildSoleAdminGuardedButton({
        label: "Admin lemondása",
        isSoleAdmin: adminCount <= 1,
        onConfirmed: async (btn) => {
          btn.disabled = true;
          await demoteToUser(overview.id, m.user_id);
          await reloadAfterMembershipChange();
        },
      }));
    }

    if (isMe) {
      actions.appendChild(buildSoleAdminGuardedButton({
        label: "Kilépés",
        isSoleAdmin: m.role === "admin" && adminCount <= 1,
        onConfirmed: async (btn) => {
          btn.disabled = true;
          await leaveBaby(overview.id, m.user_id);
          await reloadAfterMembershipChange();
        },
      }));
    }

    row.appendChild(actions);
    card.appendChild(row);
  });

  return card;
}

// Egy admin-t érintő önkéntes lemondás/kilépés gombja — ha ő az egyetlen
// admin, első kattintásra egy egyértelmű figyelmeztetést mutat (nem tiltja
// a műveletet, csak tudatosítja a következményét), csak a MÁSODIK
// kattintás hajtja végre ténylegesen.
function buildSoleAdminGuardedButton({ label, isSoleAdmin, onConfirmed }) {
  const wrap = h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" } });
  let awaitingConfirm = false;
  const btn = h("button", { className: "btn-reject", text: label });
  const warn = h("div");
  btn.addEventListener("click", () => {
    if (isSoleAdmin && !awaitingConfirm) {
      awaitingConfirm = true;
      btn.textContent = "Biztosan? Kattints újra";
      warn.innerHTML = "";
      warn.appendChild(h("div", { className: "modal-delete-warn", style: { fontSize: "11.5px" } }, [
        h("span", { text: "⚠" }),
        h("span", { text: "Te vagy ennek a babának az egyetlen admin-ja. Ha folytatod, senki nem tudja többé jóváhagyni az új usereket vagy kezelni a babát, amíg az owner be nem avatkozik." }),
      ]));
      return;
    }
    onConfirmed(btn);
  });
  wrap.append(warn, btn);
  return wrap;
}

// ---- "Minden felhasználó (Owner nézet)" ----

function buildOwnerOverview(st) {
  const container = h("div");

  if (st.usersOverview.length === 0) {
    container.appendChild(h("div", { className: "hint-box", text: "Még nincs egyetlen baba sem a rendszerben." }));
    return container;
  }

  st.usersOverview.forEach((baby) => container.appendChild(buildOwnerBabyCard(baby)));
  return container;
}

function buildOwnerBabyCard(baby) {
  const card = h("div", { className: "card" });

  const titleRow = h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" } });
  titleRow.appendChild(h("h3", {
    text: baby.nickname,
    style: { fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: "700", margin: 0 },
  }));

  const approvedMembers = (baby.baby_members || []).filter((m) => m.status === "approved");
  const admins = approvedMembers.filter((m) => m.role === "admin");
  const hasAdmin = admins.length > 0;

  if (!hasAdmin) {
    titleRow.appendChild(h("span", { className: "status-badge red", text: "Nincs admin!" }));
  }
  card.appendChild(titleRow);

  if (approvedMembers.length === 0) {
    card.appendChild(h("div", { className: "hint-box", text: "Nincs jóváhagyott tagja.", style: { marginBottom: hasAdmin ? 0 : "12px" } }));
  } else {
    approvedMembers.forEach((m) => {
      const row = h("div", { className: "request-row" });
      row.appendChild(h("div", { className: "request-info", text: `${shortId(m.user_id)} — ${m.role === "admin" ? "admin" : "user"}` }));
      card.appendChild(row);
    });
  }

  if (!hasAdmin) {
    const approvedUsers = approvedMembers.filter((m) => m.role === "user");
    if (approvedUsers.length > 0) {
      const promoteRow = h("div", { style: { display: "flex", gap: "6px", alignItems: "center", marginTop: "10px", flexWrap: "wrap" } });
      const select = document.createElement("select");
      select.className = "btn-secondary";
      approvedUsers.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.user_id;
        opt.textContent = shortId(m.user_id);
        select.appendChild(opt);
      });
      const promoteBtn = h("button", { className: "btn-approve", text: "Kinevez adminná" });
      promoteBtn.addEventListener("click", async () => {
        promoteBtn.disabled = true;
        await promoteToAdmin(baby.id, select.value);
        await openUsers();
      });
      promoteRow.append(select, promoteBtn);
      card.appendChild(promoteRow);
    }

    let confirmDelete = false;
    const deleteWarn = h("div");
    const deleteBtn = h("button", { className: "modal-delete-btn", style: { marginTop: "10px" } });
    deleteBtn.append(h("span", { text: "🗑" }), h("span", { text: "Baba törlése" }));
    deleteBtn.addEventListener("click", async () => {
      if (!confirmDelete) {
        confirmDelete = true;
        deleteBtn.classList.add("confirm");
        deleteBtn.lastChild.textContent = "Igen, törlöm";
        deleteWarn.innerHTML = "";
        deleteWarn.appendChild(h("div", { className: "modal-delete-warn" }, [
          h("span", { text: "⚠" }),
          h("span", { text: "Biztosan törlöd? A baba összes adata (súlymérések, szoptatások, pelenkák, stb.) véglegesen elvész. Ez nem vonható vissza." }),
        ]));
        return;
      }
      deleteBtn.disabled = true;
      try {
        await deleteBaby(baby.id);
        await openUsers();
      } catch (e) {
        alert(e.message);
        deleteBtn.disabled = false;
      }
    });
    card.appendChild(deleteWarn);
    card.appendChild(deleteBtn);
  }

  return card;
}
