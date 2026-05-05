// PATCH-style update for the caller's own profile.
// Validates display_name (1–40), status_emoji (allowlist), status_text (≤60, plain text),
// and visibility ('friends_only' | 'private'). Stores nothing else.
// SECURITY: this function never reads or returns OTHER users' data — only the caller's row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mirror of public.is_allowed_status_emoji. Source of truth is the DB; this is a fast reject.
const ALLOWED_STATUS_EMOJI = ["🍎","🍊","🍌","🍇","🍓","🍉","🍑","🍒","🍍","🌿"];

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripControl(s: string): string {
  // Remove ASCII control chars + DEL. Keeps regular spaces.
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);
  const userId = user.id;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const patch: Record<string, unknown> = {};

  if ("display_name" in body) {
    const v = body.display_name;
    if (typeof v !== "string") return json({ error: "display_name must be string" }, 400);
    const cleaned = stripControl(v);
    if (cleaned.length < 1 || cleaned.length > 40) {
      return json({ error: "display_name must be 1–40 chars" }, 400);
    }
    patch.display_name = cleaned;
  }

  if ("status_emoji" in body) {
    const v = body.status_emoji;
    if (v === null) {
      patch.status_emoji = null;
    } else if (typeof v !== "string" || !ALLOWED_STATUS_EMOJI.includes(v)) {
      return json({ error: "status_emoji not in allowlist" }, 400);
    } else {
      patch.status_emoji = v;
    }
  }

  if ("status_text" in body) {
    const v = body.status_text;
    if (v === null) {
      patch.status_text = null;
    } else if (typeof v !== "string") {
      return json({ error: "status_text must be string" }, 400);
    } else {
      const cleaned = stripControl(v);
      if (cleaned.length > 60) return json({ error: "status_text must be ≤60 chars" }, 400);
      // We DO NOT parse markdown or HTML. Stored as literal text.
      patch.status_text = cleaned.length === 0 ? null : cleaned;
    }
  }

  if ("visibility" in body) {
    const v = body.visibility;
    if (v !== "friends_only" && v !== "private") {
      return json({ error: "visibility must be 'friends_only' or 'private'" }, 400);
    }
    patch.visibility = v;
  }

  if (Object.keys(patch).length === 0) {
    return json({ error: "no fields to update" }, 400);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, handle, display_name, avatar_url, status_emoji, status_text, status_updated_at, visibility")
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ profile: data });
});