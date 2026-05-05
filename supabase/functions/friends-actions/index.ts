// Friend graph actions. All require an authenticated user.
// POST /friends-actions/by-handle  { handle }                -> sends request via send_friend_request RPC
// POST /friends-actions/by-token   { userId, token }         -> verifies token then sends request
// POST /friends-actions/respond    { friendshipId, action }  -> action: 'accept' | 'decline' | 'remove' | 'block'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();
  const body = await req.json().catch(() => ({}));

  try {
    if (action === "by-handle") {
      const handle = String(body?.handle ?? "").trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) return json({ error: "invalid handle" }, 400);
      const { data: target, error } = await supabase
        .from("profiles").select("id, handle, display_name").eq("handle", handle).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!target) return json({ error: "no user with that handle" }, 404);
      if (target.id === user.id) return json({ error: "cannot friend yourself" }, 400);
      const { data, error: rpcErr } = await supabase.rpc("send_friend_request", { _target: target.id });
      if (rpcErr) {
        const msg = rpcErr.message ?? "";
        if (msg.includes("blocked")) return json({ error: "blocked" }, 403);
        return json({ error: msg }, 400);
      }
      return json({ friendship: data, target });
    }

    if (action === "by-token") {
      const token = String(body?.token ?? "");
      const claimedUserId = String(body?.userId ?? "");
      if (!token || !claimedUserId) return json({ error: "token and userId required" }, 400);
      // Re-use verify endpoint via internal call
      const verifyRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/friends-qr/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          Authorization: authHeader,
        },
        body: JSON.stringify({ token }),
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) return json(verifyJson, verifyRes.status);
      if (verifyJson.userId !== claimedUserId) return json({ error: "token/user mismatch" }, 400);
      if (verifyJson.userId === user.id) return json({ error: "cannot friend yourself" }, 400);
      const { data, error: rpcErr } = await supabase.rpc("send_friend_request", { _target: verifyJson.userId });
      if (rpcErr) {
        if ((rpcErr.message ?? "").includes("blocked")) return json({ error: "blocked" }, 403);
        return json({ error: rpcErr.message }, 400);
      }
      return json({ friendship: data });
    }

    if (action === "respond") {
      const friendshipId = String(body?.friendshipId ?? "");
      const respond = String(body?.action ?? "");
      if (!friendshipId) return json({ error: "friendshipId required" }, 400);
      const { data: row, error } = await supabase
        .from("friendships").select("*").eq("id", friendshipId).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!row) return json({ error: "not found" }, 404);
      if (row.user_a !== user.id && row.user_b !== user.id) return json({ error: "forbidden" }, 403);

      if (respond === "accept") {
        if (row.requested_by === user.id) return json({ error: "cannot accept your own request" }, 400);
        const { data: upd, error: e2 } = await supabase
          .from("friendships").update({ status: "accepted" }).eq("id", friendshipId).select().single();
        if (e2) return json({ error: e2.message }, 400);
        return json({ friendship: upd });
      }
      if (respond === "decline" || respond === "remove") {
        const { error: e2 } = await supabase.from("friendships").delete().eq("id", friendshipId);
        if (e2) return json({ error: e2.message }, 400);
        return json({ ok: true });
      }
      if (respond === "block") {
        const { data: upd, error: e2 } = await supabase
          .from("friendships").update({ status: "blocked", requested_by: user.id }).eq("id", friendshipId).select().single();
        if (e2) return json({ error: e2.message }, 400);
        return json({ friendship: upd });
      }
      return json({ error: "unknown action" }, 400);
    }

    return json({ error: "unknown route" }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});