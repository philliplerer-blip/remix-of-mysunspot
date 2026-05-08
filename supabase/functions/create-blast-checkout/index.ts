// Stub payment-session creator. Stripe and MobilePay live keys are intentionally
// NOT wired up — this returns a fake checkout URL that flips the blast to "paid"
// immediately so the rest of the pipeline can be tested end-to-end.
//
// TODO(payments): replace the stub branch below with real Stripe Checkout
// (and MobilePay via Stripe payment_method_types: ["mobilepay"]) once API keys
// are added as Lovable Cloud secrets: STRIPE_SECRET_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY"); // optional in test mode
const BLAST_PRICE_DKK = 49;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userRes.user;

    const body = await req.json();
    const venue_id: string = body.venue_id;
    const title: string = (body.title ?? "").toString().trim();
    const blastBody: string = (body.body ?? "").toString().trim();
    const link_url: string | null = body.link_url?.toString().trim() || null;
    const payment_method: "card" | "mobilepay" = body.payment_method === "mobilepay" ? "mobilepay" : "card";

    if (!venue_id || !title || !blastBody) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (title.length > 80 || blastBody.length > 240) {
      return new Response(JSON.stringify({ error: "title or body too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Verify the user owns this venue.
    const { data: ownerCheck } = await admin
      .from("venue_owners").select("id").eq("user_id", user.id).eq("venue_id", venue_id).maybeSingle();
    if (!ownerCheck) {
      return new Response(JSON.stringify({ error: "not a venue owner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Rate limit (max 2/day, 7/week per venue).
    const { data: canSend } = await admin.rpc("venue_can_send_blast", { _venue_id: venue_id });
    if (canSend === false) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "Max 2 blasts per day, 7 per week." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Insert the draft blast.
    const { data: blast, error: insertErr } = await admin.from("blasts").insert({
      venue_id, sent_by: user.id, title, body: blastBody, link_url,
      status: "pending_payment", amount_dkk: BLAST_PRICE_DKK,
    }).select("id").single();
    if (insertErr || !blast) throw insertErr ?? new Error("insert failed");

    // 4a. REAL STRIPE PATH (only runs once STRIPE_SECRET_KEY is configured).
    if (STRIPE_SECRET_KEY) {
      // TODO(payments): real Stripe Checkout Session creation goes here.
      // For now even with the key we still fall through to the stub so nothing
      // breaks. Remove this comment + branch when implementing.
    }

    // 4b. STUB PATH — auto-mark as paid and trigger send.
    const stripeSessionId = `test_${crypto.randomUUID()}`;
    await admin.from("blasts").update({
      status: "paid", paid_at: new Date().toISOString(), stripe_session_id: stripeSessionId,
    }).eq("id", blast.id);

    // Fire-and-forget send (don't block the response on full fan-out).
    const sendUrl = `${SUPABASE_URL}/functions/v1/send-venue-blast`;
    fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({ blast_id: blast.id }),
    }).catch((e) => console.error("send-venue-blast trigger failed", e));

    return new Response(JSON.stringify({
      ok: true,
      blast_id: blast.id,
      test_mode: true,
      payment_method,
      checkout_url: null, // TODO: real Stripe URL when wired
      message: `TEST MODE: ${payment_method === "mobilepay" ? "MobilePay" : "card"} payment auto-confirmed. Blast queued for delivery.`,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});