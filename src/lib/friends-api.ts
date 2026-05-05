import { supabase } from "@/integrations/supabase/client";

export type Friendship = {
  id: string;
  user_a: string;
  user_b: string;
  requested_by: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  updated_at: string;
};

export type PresenceSession = {
  id: string;
  user_id: string;
  activity: string;
  bar_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  started_at: string;
  expires_at: string;
};

export type ProfileLite = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

async function call<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(fn, { body });
  if (error) throw error;
  return data as T;
}

export const friendsApi = {
  mintQr: () => call<{ token: string; expiresAt: number; deepLink: string; webLink: string }>("friends-qr/mint", {}),
  verifyToken: (token: string) => call<{ userId: string }>("friends-qr/verify", { token }),
  requestByHandle: (handle: string) =>
    call<{ friendship: Friendship; target: ProfileLite }>("friends-actions/by-handle", { handle }),
  requestByToken: (userId: string, token: string) =>
    call<{ friendship: Friendship }>("friends-actions/by-token", { userId, token }),
  respond: (friendshipId: string, action: "accept" | "decline" | "remove" | "block") =>
    call<{ friendship?: Friendship; ok?: boolean }>("friends-actions/respond", { friendshipId, action }),
};

export async function setHandle(handle: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  const clean = handle.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) throw new Error("Handle must be 3–20 chars: a–z, 0–9, _");
  const { data, error } = await supabase
    .from("profiles").update({ handle: clean }).eq("id", user.id).select().single();
  if (error) throw error;
  return data;
}

export async function startPresence(args: {
  activity: string; barId?: string | null; lat?: number | null; lng?: number | null; durationMinutes: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  const minutes = Math.min(Math.max(args.durationMinutes, 5), 240);
  const expires_at = new Date(Date.now() + minutes * 60_000).toISOString();
  const { data, error } = await supabase.from("presence_sessions").insert({
    user_id: user.id,
    activity: args.activity.slice(0, 80),
    bar_id: args.barId ?? null,
    location_lat: args.lat ?? null,
    location_lng: args.lng ?? null,
    expires_at,
  }).select().single();
  if (error) throw error;
  return data as PresenceSession;
}

export async function endPresence(sessionId: string) {
  const { error } = await supabase.from("presence_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

export async function getMyActivePresence(): Promise<PresenceSession | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("presence_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  return data as PresenceSession | null;
}

export async function getActiveFriendsPresence() {
  // RLS + view together ensure: only accepted-friend rows, never expired, no location after expiry.
  const { data, error } = await supabase
    .from("active_presence_sessions")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listFriendships(): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Friendship[]) ?? [];
}

export async function getProfilesByIds(ids: string[]): Promise<Record<string, ProfileLite>> {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("profiles").select("id, handle, display_name, avatar_url").in("id", ids);
  if (error) throw error;
  const out: Record<string, ProfileLite> = {};
  for (const p of (data ?? []) as ProfileLite[]) out[p.id] = p;
  return out;
}

export async function getMyProfile(): Promise<ProfileLite | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles").select("id, handle, display_name, avatar_url").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data as ProfileLite | null;
}