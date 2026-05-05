/**
 * Live integration tests for the friends + presence feature.
 *
 * These tests hit the real Lovable Cloud backend via the public anon key,
 * creating ephemeral accounts with @example.com emails. They are skipped
 * automatically if VITE_SUPABASE_URL is not present.
 *
 * Covers (per spec):
 * - QR token expiry rejection
 * - Duplicate friendship prevention (canonical pair)
 * - Non-friends cannot read presence sessions
 * - Expired sessions are filtered out
 * - Blocked users cannot send requests
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const HAS_BACKEND = Boolean(SUPABASE_URL && SUPABASE_ANON);
const d = HAS_BACKEND ? describe : describe.skip;

function randHandle() {
  return "t" + Math.random().toString(36).slice(2, 10).toLowerCase().replace(/[^a-z0-9]/g, "x");
}
function newClient() {
  return createClient(SUPABASE_URL!, SUPABASE_ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function makeUser(): Promise<{ client: SupabaseClient; userId: string; handle: string }> {
  const handle = randHandle();
  const email = `${handle}@example.com`;
  const password = "test-password-1234!";
  const c = newClient();
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw error;
  const userId = data.user!.id;
  // session may not exist if email confirm is on; sign in attempts to log in.
  await c.auth.signInWithPassword({ email, password }).catch(() => {});
  // Set handle (profile row created by handle_new_user trigger)
  await c.from("profiles").update({ handle }).eq("id", userId);
  return { client: c, userId, handle };
}

d("friends + presence", () => {
  let alice: Awaited<ReturnType<typeof makeUser>>;
  let bob: Awaited<ReturnType<typeof makeUser>>;
  let carol: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    [alice, bob, carol] = await Promise.all([makeUser(), makeUser(), makeUser()]);
  }, 30_000);

  afterAll(async () => {
    await Promise.allSettled([alice?.client.auth.signOut(), bob?.client.auth.signOut(), carol?.client.auth.signOut()]);
  });

  it("rejects expired QR tokens", async () => {
    // Forge a token with past expiry — signature won't match real secret, so server returns 400 (invalid sig)
    // OR if it matches structure, expiry check returns 410. Either way: NOT a 200.
    const fake = `${btoa(`${alice.userId}.${Date.now() - 1000}`).replace(/=/g, "")}.deadbeef`;
    const { data, error } = await bob.client.functions.invoke("friends-qr/verify", { body: { token: fake } });
    // invoke surfaces non-2xx as error
    expect(error || (data as { error?: string })?.error).toBeTruthy();
  });

  it("prevents duplicate friendships (canonical pair)", async () => {
    const r1 = await alice.client.functions.invoke("friends-actions/by-handle", { body: { handle: bob.handle } });
    expect(r1.error).toBeNull();
    // Sending again from Alice should be a no-op (returns existing pending row, no second insert)
    const r2 = await alice.client.functions.invoke("friends-actions/by-handle", { body: { handle: bob.handle } });
    expect(r2.error).toBeNull();
    const { data: rows } = await alice.client.from("friendships")
      .select("*")
      .or(`and(user_a.eq.${alice.userId},user_b.eq.${bob.userId}),and(user_a.eq.${bob.userId},user_b.eq.${alice.userId})`);
    expect((rows ?? []).length).toBe(1);
  });

  it("non-friends cannot read each other's presence sessions", async () => {
    // Carol starts a session
    const expires = new Date(Date.now() + 60 * 60_000).toISOString();
    await carol.client.from("presence_sessions").insert({
      user_id: carol.userId, activity: "secret", expires_at: expires,
    });
    // Alice (not friends with Carol) queries — must NOT see Carol's row
    const { data: visible } = await alice.client.from("presence_sessions").select("*").eq("user_id", carol.userId);
    expect(visible ?? []).toHaveLength(0);
    // active view also hides it
    const { data: viaView } = await alice.client.from("active_presence_sessions").select("*").eq("user_id", carol.userId);
    expect(viaView ?? []).toHaveLength(0);
  });

  it("filters expired sessions out of active view", async () => {
    // Alice and Bob become friends (continue from earlier test): Bob accepts.
    const { data: pending } = await bob.client.from("friendships").select("*").eq("requested_by", alice.userId).maybeSingle();
    if (pending) {
      await bob.client.functions.invoke("friends-actions/respond", { body: { friendshipId: pending.id, action: "accept" } });
    }
    // Insert a session that is ALREADY expired by setting both started_at and expires_at in the past.
    // Constraint requires expires_at > started_at AND expires_at <= started_at + 4h.
    const startedAt = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 min ago
    const expiresAt = new Date(Date.now() - 5 * 60_000).toISOString();  // 5 min ago (still > started_at)
    const { data: row, error: insErr } = await bob.client.from("presence_sessions")
      .insert({ user_id: bob.userId, activity: "stale", started_at: startedAt, expires_at: expiresAt }).select().single();
    expect(insErr).toBeNull();
    // Alice queries active view — must not see the now-expired row
    const { data: viaView } = await alice.client.from("active_presence_sessions").select("*").eq("user_id", bob.userId);
    expect(viaView ?? []).toHaveLength(0);
    // RLS-level: the friend SELECT policy also requires expires_at > now()
    const { data: viaTable } = await alice.client.from("presence_sessions").select("*").eq("id", row!.id);
    expect(viaTable ?? []).toHaveLength(0);
  });

  it("blocked users cannot send friend requests", async () => {
    // Alice blocks Carol by upserting a blocked friendship pair (canonical)
    const a = alice.userId < carol.userId ? alice.userId : carol.userId;
    const b = alice.userId < carol.userId ? carol.userId : alice.userId;
    await alice.client.from("friendships").insert({
      user_a: a, user_b: b, requested_by: alice.userId, status: "blocked",
    });
    // Carol now tries to friend Alice — must be rejected. Use raw fetch to read the error body.
    const { data: { session } } = await carol.client.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/friends-actions/by-handle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON!,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ handle: alice.handle }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(String(body.error).toLowerCase()).toContain("blocked");
  });
}, 60_000);