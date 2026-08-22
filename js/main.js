// Belépési pont: session-bootstrap, állapot-feliratkozás, első renderelés,
// service worker regisztráció (PWA offline-shell + frissítés-jelzés).
import { supabase } from "./supabase-client.js";
import { setState, subscribe } from "./state.js";
import { renderApp } from "./render.js";
import { enterSession } from "./session.js";
import { registerServiceWorker } from "./sw-update.js";

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
      pendingMemberships: [],
      activeBabyId: null,
      pendingRequests: [],
      isOwner: false,
      usersOverviewOwn: null,
      usersOverviewOwner: null,
      usersOverviewTab: "own",
    });
  }
});

bootstrap();
registerServiceWorker();
