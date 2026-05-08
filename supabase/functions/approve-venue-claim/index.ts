// Admin-only: approve or reject a venue claim. On approval, grants the
// venue_owner role and links the user to the venue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { claim_id, action, reject_reason } = await req.json();
    if (!claim_id || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claim } = await admin.from("venue_claims").select("*").eq("id", claim_id).single();
    if (!claim) {
      return new Response(JSON.stringify({ error: "claim not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      await admin.from("venue_owners").upsert({ user_id: claim.user_id, venue_id: claim.venue_id }, { onConflict: "user_id,venue_id" });
      await admin.from("user_roles").upsert({ user_id: claim.user_id, role: "venue_owner" }, { onConflict: "user_id,role" });
      await admin.from("venue_claims").update({
        status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: userRes.user.id,
      }).eq("id", claim_id);
    } else {
      await admin.from("venue_claims").update({
        status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: userRes.user.id,
        reject_reason: reject_reason ?? null,
      }).eq("id", claim_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});