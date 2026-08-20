// Service worker regisztráció + frissítés-kezelés. Két felületen jelenik meg:
// egy alsó sáv (csak ha van frissítés) és egy állandó fejléc-gomb, ami akkor
// is elérhető marad, ha a user véletlenül elhúzta/figyelmen kívül hagyta a
// sávot — enélkül a "waiting" service worker némán, észrevétlenül várna.

import { getState, setState } from "./state.js";

let swRegistration = null;

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
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setState({ updateAvailable: true, waitingWorker: newWorker });
          }
        });
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

// Kézi ellenőrzés — a fejléc-gomb erre az esetre kell: ha nincs (már ismert)
// várakozó verzió, aktívan rákérdezünk a szerverre, hátha közben megjelent
// egy újabb service-worker.js.
async function checkForUpdate() {
  if (!swRegistration) return;
  try {
    await swRegistration.update();
  } catch {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (swRegistration.waiting) {
    setState({ updateAvailable: true, waitingWorker: swRegistration.waiting });
    swRegistration.waiting.postMessage("SKIP_WAITING");
  } else {
    setState({ infoModal: { title: "Nincs új verzió", message: "Jelenleg ez a legfrissebb elérhető verzió fut." } });
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
