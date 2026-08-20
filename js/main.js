// Belépési pont: session-bootstrap, állapot-feliratkozás, első renderelés,
// service worker regisztráció (PWA offline-shell + frissítés-jelzés).
import { supabase } from "./supabase-client.js";
import { setState, subscribe } from "./state.js";
import { renderApp } from "./render.js";
import { enterSession } from "./session.js";

subscribe(renderApp);
renderApp();

async function bootstrap() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await enterSession(data.session);
    } else {
      setState({ status: "auth" });
    }
  } catch (e) {
    // Jellemzően offline induláskor (nincs cache-elt session-adat, a
    // Supabase-hívás elhasal) — világos üzenetet mutatunk elavult/hamis
    // adat helyett, ahelyett hogy a "Betöltés…" képernyőn ragadna az app.
    setState({
      status: "boot-error",
      bootError: "Nincs internetkapcsolat, vagy a szerver nem érhető el. Ellenőrizd a kapcsolatot, és próbáld újra.",
    });
  }
}

// Külső (pl. más lapon történő) kijelentkezés vagy lejárt session esetére.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    setState({
      status: "auth",
      authMode: "login",
      session: null,
      memberships: [],
      activeBabyId: null,
      pendingRequests: [],
    });
  }
});

bootstrap();

// ---- PWA: service worker regisztráció + frissítés-jelzés ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          // "installed" + van már aktív vezérlő SW ⇒ ez egy FRISSÍTÉS (nem az
          // első telepítés), tehát van értelme megkérdezni a usert.
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setState({ updateAvailable: true, waitingWorker: newWorker });
          }
        });
      });
    }).catch(() => {
      // Service worker regisztráció sikertelen (pl. nem secure context) —
      // az app enélkül is működik, csak PWA-funkciók nélkül.
    });
  });

  // Amint az újonnan aktivált SW átveszi az irányítást, egyszer újratöltjük
  // az oldalt, hogy a friss (nem cache-elt) app-kerettel fusson tovább.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}
