// Belépési pont: session-bootstrap, állapot-feliratkozás, első renderelés,
// service worker regisztráció (PWA offline-shell + frissítés-jelzés).
import { supabase } from "./supabase-client.js";
import { getState, setState, subscribe } from "./state.js";
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
supabase.auth.onAuthStateChange((event, session) => {
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

  // A megerősítő email linkjéről visszatérve a supabase-js kliens
  // (detectSessionInUrl) automatikusan létrehozza a sessiont és ezt az
  // eseményt küldi. A bootstrap() elméletileg megvárja ezt, de ha
  // versenyhelyzetben mégis előbb futna le (és a user emiatt egy üres
  // auth/loading képernyőn ragadna, holott már be van jelentkezve), ez a
  // kezelő pótlólag belépteti.
  if (event === "SIGNED_IN" && session) {
    const st = getState();
    if (st.status === "auth" || st.status === "loading") {
      enterSession(session);
    }
  }
});

bootstrap();
registerServiceWorker();
