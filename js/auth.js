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

// Email + jelszó regisztráció (Supabase Auth). Feltételezi, hogy a Supabase
// projektben az email-megerősítés ki van kapcsolva (vagy a session azonnal
// elérhető) — enélkül nincs hitelesített auth.uid(), amit az RLS policy-k
// a következő lépésben (baba nickname megadása) megkövetelnek.
export async function signUpAccount(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { session: data.session, needsEmailConfirmation: !data.session };
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
export async function resolveUserStatus(userId) {
  const memberships = await getMyMemberships(userId);
  const approved = memberships.filter((m) => m.status === "approved");
  const hasPending = memberships.some((m) => m.status === "pending");

  if (approved.length > 0) return { status: "dashboard", memberships: approved };
  if (hasPending) return { status: "pending", memberships: [] };
  return { status: "needs-registration", memberships: [] };
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
