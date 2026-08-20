// Belépési pont: session-bootstrap, állapot-feliratkozás, első renderelés.
import { supabase } from "./supabase-client.js";
import { setState, subscribe } from "./state.js";
import { renderApp } from "./render.js";
import { enterSession } from "./session.js";

subscribe(renderApp);
renderApp();

async function bootstrap() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await enterSession(data.session);
  } else {
    setState({ status: "auth" });
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
