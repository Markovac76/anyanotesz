import { supabase } from "./supabase-client.js";
import {
  findBabyByNickname,
  createBabyWithAdmin,
  createMembership,
  getMyMemberships,
  getPendingRequestsForAdminBabies,
  approveMembership,
  rejectMembership,
} from "./data.js";

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Email + jelszó regisztráció (Supabase Auth). A Supabase projektben be
// van kapcsolva a "Confirm email" — signUp() után a session még nem
// elérhető, amíg a user rá nem kattint a kiküldött megerősítő linkre
// (utána a supabase-js kliens a detectSessionInUrl miatt automatikusan
// létrehozza a sessiont, lásd main.js SIGNED_IN kezelése).
//
// Anti-enumeration védelemből, ha valaki egy MÁR regisztrált, megerősített
// emaillel hív signUp()-ot, a Supabase nem hibát ad, hanem egy obfuszkált
// user objektumot, session: null-lal — és nem is küld ki emailt. Ezt az
// `identities` tömb üressége árulja el (új regisztrációnál legalább egy
// elem van benne), enélkül a hívó fél tévesen "erősítsd meg az emailed"
// üzenetet látna egy sosem érkező emailre várva.
export async function signUpAccount(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  const looksLikeExistingUser = !data.session && (data.user?.identities?.length ?? 0) === 0;
  if (looksLikeExistingUser) {
    return { session: null, needsEmailConfirmation: false, alreadyRegistered: true };
  }

  return { session: data.session, needsEmailConfirmation: !data.session, alreadyRegistered: false };
}

// A regisztráció (vagy egy korábban félbeszakadt regisztráció) folytatása:
// a user megadja a baba becenevét, a rendszer csatlakozik egy meglévő
// babához, vagy újat hoz létre.
export async function joinOrCreateBaby({ userId, nickname, fullName }) {
  const existing = await findBabyByNickname(nickname);

  if (existing) {
    await createMembership({ babyId: existing.id, userId, role: "user", status: "pending" });
    return { status: "pending", baby: existing };
  }

  try {
    // Atomikus RPC: a baba és az admin-tagság egy tranzakcióban jön
    // létre (0007_lock_babies_select.sql) — nincs "check majd insert"
    // versenyhelyzet a saját hívásunkon belül.
    const baby = await createBabyWithAdmin(nickname, fullName);
    return { status: "approved", baby };
  } catch (e) {
    // 23505 = Postgres unique_violation — valaki más, pár másodperccel
    // előttünk, épp most hozta létre ugyanezt a becenevet
    // (babies_nickname_unique_ci). Ilyenkor ne hibaüzenetet mutassunk,
    // hanem csatlakozzunk a most létrejött babához pending user-ként.
    if (e.code === "23505") {
      const raceWinner = await findBabyByNickname(nickname);
      if (raceWinner) {
        await createMembership({ babyId: raceWinner.id, userId, role: "user", status: "pending" });
        return { status: "pending", baby: raceWinner };
      }
    }
    throw e;
  }
}

// Eldönti, hogy egy bejelentkezett usernek dashboardot, "várakozás
// jóváhagyásra" képernyőt, vagy a regisztráció folytatását kell mutatni.
// A "pending" lista mindig visszajön (üresen is), hogy a dashboard baba-
// választója meg tudja jeleníteni a MÁSIK babákhoz küldött, még jóvá nem
// hagyott kérelmeket is — nem csak azt az egy esetet, amikor a usernek
// EGYETLEN jóváhagyott tagsága sincs.
export async function resolveUserStatus(userId) {
  const memberships = await getMyMemberships(userId);
  const approved = memberships.filter((m) => m.status === "approved");
  const pending = memberships.filter((m) => m.status === "pending");

  if (approved.length > 0) return { status: "dashboard", memberships: approved, pending };
  if (pending.length > 0) return { status: "pending", memberships: [], pending };
  return { status: "needs-registration", memberships: [], pending: [] };
}

export async function loadPendingRequests(adminBabyIds) {
  return await getPendingRequestsForAdminBabies(adminBabyIds);
}

export async function approveRequest(babyId, userId, currentUserId) {
  await approveMembership(babyId, userId, currentUserId);
}

export async function rejectRequest(babyId, userId) {
  await rejectMembership(babyId, userId);
}
