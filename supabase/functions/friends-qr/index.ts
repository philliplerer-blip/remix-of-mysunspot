// Mints and verifies short-lived HMAC-signed QR invite tokens.
// POST /friends-qr/mint   -> { token, expiresAt, deepLink, webLink }
// POST /friends-qr/verify -> { userId } | 400/410 on invalid/expired
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECRET = Deno.env.get("FRIENDS_QR_SECRET") ?? "";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return b64url(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function mintToken(userId: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const sig = await hmac(payload);
  const token = `${b64url(new TextEncoder().encode(payload))}.${sig}`;
  return { token, expiresAt };
}

async function verifyToken(token: string): Promise<{ userId: string } | { error: string; status: number }> {
  const parts = token.split(".");
  if (parts.length !== 2) return { error: "malformed token", status: 400 };
  const [payloadB64, sig] = parts;
  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlDecode(payloadB64));
  } catch {
    return { error: "malformed token", status: 400 };
  }
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return { error: "invalid signature", status: 400 };
  const [userId, expiresAtStr] = payload.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!userId || !Number.isFinite(expiresAt)) return { error: "malformed payload", status: 400 };
  if (expiresAt < Date.now()) return { error: "token expired", status: 410 };
  return { userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SECRET) {
    return new Response(JSON.stringify({ error: "FRIENDS_QR_SECRET not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();

  try {
    if (action === "mint") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { token, expiresAt } = await mintToken(user.id);
      const origin = req.headers.get("origin") ?? "";
      const webLink = `${origin}/friends/add?u=${user.id}&t=${token}`;
      const deepLink = `sunnybars://add?u=${user.id}&t=${token}`;
      return new Response(
        JSON.stringify({ token, expiresAt, deepLink, webLink }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "verify") {
      const body = await req.json().catch(() => ({}));
      const token = String(body?.token ?? "");
      if (!token) {
        return new Response(JSON.stringify({ error: "token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await verifyToken(token);
      if ("error" in result) {
        return new Response(JSON.stringify(result), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});