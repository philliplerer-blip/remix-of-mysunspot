/**
 * Live integration tests for the profile + visibility-gating system.
 * Hits real Lovable Cloud via the anon key.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const HAS = Boolean(SUPABASE_URL && SUPABASE_ANON);
const d = HAS ? describe : describe.skip;

function rand() {
  return "p" + Math.random().toString(36).slice(2, 10).toLowerCase().replace(/[^a-z0-9]/g, "x");
}
function newClient() {
  return createClient(SUPABASE_URL!, SUPABASE_ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function makeUser() {
  const handle = rand();
  const c = newClient();
  const { data, error } = await c.auth.signUp({ email: `${handle}@example.com`, password: "test-password-1234!" });
  if (error) throw error;
  await c.auth.signInWithPassword({ email: `${handle}@example.com`, password: "test-password-1234!" }).catch(() => {});
  await c.from("profiles").update({ handle, display_name: handle }).eq("id", data.user!.id);
  return { client: c, userId: data.user!.id, handle };
}
async function befriend(a: Awaited<ReturnType<typeof makeUser>>, b: Awaited<ReturnType<typeof makeUser>>) {
  await a.client.functions.invoke("friends-actions/by-handle", { body: { handle: b.handle } });
  const { data: pending } = await b.client.from("friendships").select("*").eq("requested_by", a.userId).maybeSingle();
  if (pending) {
    await b.client.functions.invoke("friends-actions/respond", { body: { friendshipId: pending.id, action: "accept" } });
  }
}

d("profile + visibility", () => {
  let alice: Awaited<ReturnType<typeof makeUser>>;
  let bob:   Awaited<ReturnType<typeof makeUser>>;
  let carol: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    [alice, bob, carol] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    await befriend(alice, bob); // Alice <-> Bob accepted
    // alice <-> carol: leave as a pending request
    await alice.client.functions.invoke("friends-actions/by-handle", { body: { handle: carol.handle } });
  }, 60_000);

  afterAll(async () => {
    await Promise.allSettled([alice?.client.auth.signOut(), bob?.client.auth.signOut(), carol?.client.auth.signOut()]);
  });

  it("self can always read own profile", async () => {
    const { data } = await alice.client.rpc("get_profile_for_viewer", { _target_handle: alice.handle });
    expect((data as unknown[])?.length).toBe(1);
  });

  it("accepted friend gets the full profile", async () => {
    const { data } = await alice.client.rpc("get_profile_for_viewer", { _target_handle: bob.handle });
    expect((data as unknown[])?.length).toBe(1);
  });

  it("pending-request user gets empty result (→ 404 in UI)", async () => {
    const { data } = await alice.client.rpc("get_profile_for_viewer", { _target_handle: carol.handle });
    expect((data as unknown[]) ?? []).toHaveLength(0);
  });

  it("non-friend gets empty result", async () => {
    const stranger = await makeUser();
    const { data } = await stranger.client.rpc("get_profile_for_viewer", { _target_handle: alice.handle });
    expect((data as unknown[]) ?? []).toHaveLength(0);
    await stranger.client.auth.signOut();
  });

  it("non-existent and non-visible handles return identical (empty) responses", async () => {
    const stranger = await makeUser();
    const r1 = await stranger.client.rpc("get_profile_for_viewer", { _target_handle: "doesnotexist_xyz_999" });
    const r2 = await stranger.client.rpc("get_profile_for_viewer", { _target_handle: alice.handle });
    expect(((r1.data as unknown[]) ?? []).length).toBe(((r2.data as unknown[]) ?? []).length);
    expect(((r1.data as unknown[]) ?? []).length).toBe(0);
    await stranger.client.auth.signOut();
  });

  it("private overrides mutual friendship: friend gets empty, self still gets it", async () => {
    await alice.client.functions.invoke("profile-update", { body: { visibility: "private" } });
    const { data: byFriend } = await bob.client.rpc("get_profile_for_viewer", { _target_handle: alice.handle });
    expect(((byFriend as unknown[]) ?? []).length).toBe(0);
    const { data: bySelf } = await alice.client.rpc("get_profile_for_viewer", { _target_handle: alice.handle });
    expect(((bySelf as unknown[]) ?? []).length).toBe(1);
    // restore
    await alice.client.functions.invoke("profile-update", { body: { visibility: "friends_only" } });
  });

  it("block revokes visibility in both directions", async () => {
    // Bob blocks Alice
    const { data: row } = await bob.client.from("friendships").select("*")
      .or(`and(user_a.eq.${alice.userId},user_b.eq.${bob.userId}),and(user_a.eq.${bob.userId},user_b.eq.${alice.userId})`)
      .maybeSingle();
    await bob.client.functions.invoke("friends-actions/respond", { body: { friendshipId: row!.id, action: "block" } });
    const { data: aliceSeesBob } = await alice.client.rpc("get_profile_for_viewer", { _target_handle: bob.handle });
    const { data: bobSeesAlice } = await bob.client.rpc("get_profile_for_viewer", { _target_handle: alice.handle });
    expect(((aliceSeesBob as unknown[]) ?? []).length).toBe(0);
    expect(((bobSeesAlice as unknown[]) ?? []).length).toBe(0);
    // restore
    await bob.client.from("friendships").delete().eq("id", row!.id);
    await befriend(alice, bob);
  });

  it("PATCH /me/profile accepts 🌿 (hops)", async () => {
    const r = await alice.client.functions.invoke("profile-update", { body: { status_emoji: "🌿" } });
    expect(r.error).toBeNull();
    const me = await alice.client.from("profiles").select("status_emoji").eq("id", alice.userId).maybeSingle();
    expect(me.data?.status_emoji).toBe("🌿");
  });

  it.each(["🍺", "🌱", "🍃", "🍻", "X"])("PATCH /me/profile rejects %s", async (bad) => {
    const before = await alice.client.from("profiles").select("status_emoji").eq("id", alice.userId).maybeSingle();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/profile-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON!,
        Authorization: `Bearer ${(await alice.client.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ status_emoji: bad }),
    });
    expect(res.status).toBe(400);
    const after = await alice.client.from("profiles").select("status_emoji").eq("id", alice.userId).maybeSingle();
    expect(after.data?.status_emoji).toBe(before.data?.status_emoji);
  });

  it("PATCH /me/profile stores <script> as literal text", async () => {
    const payload = "<script>alert(1)</script> **bold**";
    const r = await alice.client.functions.invoke("profile-update", { body: { status_text: payload } });
    expect(r.error).toBeNull();
    const me = await alice.client.from("profiles").select("status_text").eq("id", alice.userId).maybeSingle();
    // Stored verbatim (no parsing/execution); HTML/markdown are NOT interpreted.
    expect(me.data?.status_text).toBe(payload);
  });

  it("list_visible_friend_summaries hides status_emoji for non-visible users", async () => {
    // Make alice private; bob's listing should still see alice (pending/accepted) but with NULL emoji.
    await alice.client.functions.invoke("profile-update", { body: { visibility: "private", status_emoji: "🍇" } });
    const { data } = await bob.client.rpc("list_visible_friend_summaries");
    const row = (data as Array<{ user_id: string; status_emoji: string | null }>).find((r) => r.user_id === alice.userId);
    expect(row).toBeDefined();
    expect(row?.status_emoji).toBeNull();
    await alice.client.functions.invoke("profile-update", { body: { visibility: "friends_only" } });
  });
}, 120_000);