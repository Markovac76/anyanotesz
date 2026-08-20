// Service worker regisztráció + frissítés-kezelés. Két felületen jelenik meg:
// egy alsó sáv (csak ha van frissítés) és egy állandó fejléc-gomb, ami akkor
// is elérhető marad, ha a user véletlenül elhúzta/figyelmen kívül hagyta a
// sávot — enélkül a "waiting" service worker némán, észrevétlenül várna.

import { getState, setState } from "./state.js";

let swRegistration = null;

// Egyetlen közös figyelő: egy adott "installing" workert kísér végig a
// telepítés befejezéséig, és onnantól kezelve mindig ugyanazt a
// forrás-igazságot (state.updateAvailable/waitingWorker) állítja be —
// ezt hívja mind az automatikus észlelés (updatefound), mind a fejléc-gomb
// kézi ellenőrzése, hogy a kettő sose mondhasson ellent egymásnak.
function watchInstallingWorker(newWorker) {
  newWorker.addEventListener("statechange", () => {
    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
      setState({ updateAvailable: true, waitingWorker: newWorker });
    }
  });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
      swRegistration = registration;

      // Ha már ITT, ELSŐ betöltéskor is van várakozó (telepített, de nem
      // aktivált) worker — pl. mert egy korábbi látogatáskor települt, de a
      // user elhúzta a sávot anélkül, hogy aktiválta volna —, azt is
      // jelezzük. Az "updatefound" esemény csak ÚJ telepítéskor sülne el,
      // egy már kész "waiting" workerre nem, ezért kell ez a külön ellenőrzés.
      if (registration.waiting) {
        setState({ updateAvailable: true, waitingWorker: registration.waiting });
      }

      registration.addEventListener("updatefound", () => {
        if (registration.installing) watchInstallingWorker(registration.installing);
      });
    } catch {
      // Regisztráció sikertelen (pl. nem secure context) — az app enélkül
      // is működik, csak PWA-funkciók nélkül.
    }
  });

  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}

// Már ismert, várakozó verzió aktiválása (alsó sáv "Frissítés" gombja).
export function applyUpdate() {
  const st = getState();
  st.waitingWorker?.postMessage("SKIP_WAITING");
}

let checkInFlight = false;

// Kézi ellenőrzés — a fejléc-gomb erre az esetre kell: ha nincs (már ismert)
// várakozó verzió, aktívan rákérdezünk a szerverre, hátha közben megjelent
// egy újabb service-worker.js. Fontos: ez NEM egy fix várakozási idővel
// találgat, hanem ténylegesen megvárja a telepítés (fájlok letöltése +
// cache-elése) befejezését — különben pont az itt hozott "nincs új verzió"
// döntés mondhatna ellent az updatefound-alapú automatikus észlelésnek,
// ha a telepítés a találgatott idő után fejeződik be.
export async function checkForUpdate() {
  if (!swRegistration || checkInFlight) return;
  checkInFlight = true;
  try {
    try {
      await swRegistration.update();
    } catch {
      setState({ infoModal: { title: "Nincs új verzió", message: "Jelenleg ez a legfrissebb elérhető verzió fut." } });
      return;
    }

    // Az update() közben esetleg már be is fejeződött egy korábban indult
    // telepítés — ha van kész várakozó worker, azt azonnal használjuk.
    if (swRegistration.waiting) {
      setState({ updateAvailable: true, waitingWorker: swRegistration.waiting });
      swRegistration.waiting.postMessage("SKIP_WAITING");
      return;
    }

    const installing = swRegistration.installing;
    if (!installing) {
      // Az update() nem talált eltérést a szerveren lévő service-worker.js
      // és a jelenleg futó között — tényleg nincs új verzió.
      setState({ infoModal: { title: "Nincs új verzió", message: "Jelenleg ez a legfrissebb elérhető verzió fut." } });
      return;
    }

    // Van folyamatban lévő telepítés — végigvárjuk, ahelyett hogy
    // találgatnánk, mikor lesz kész (ésszerű felső korlát mellett, hátha a
    // hálózat szokatlanul lassú, vagy a worker "redundant"-tá válik).
    const installedWorker = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        installing.removeEventListener("statechange", onChange);
        resolve(value);
      };
      const onChange = () => {
        if (installing.state === "installed") finish(installing);
        else if (installing.state === "redundant") finish(null);
      };
      installing.addEventListener("statechange", onChange);
      setTimeout(() => finish(null), 15000);
    });

    if (installedWorker) {
      setState({ updateAvailable: true, waitingWorker: installedWorker });
      installedWorker.postMessage("SKIP_WAITING");
    } else {
      setState({ infoModal: { title: "Nincs új verzió", message: "Jelenleg ez a legfrissebb elérhető verzió fut." } });
    }
  } finally {
    checkInFlight = false;
  }
}

// A fejléc-gomb kattintás-kezelője: ha már tudunk várakozó verzióról,
// azonnal aktiválja; ha nem, előbb rákérdez a szerverre.
export function triggerUpdate() {
  const st = getState();
  if (st.updateAvailable && st.waitingWorker) {
    applyUpdate();
  } else {
    checkForUpdate();
  }
}
