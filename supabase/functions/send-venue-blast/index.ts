// Fan-out a paid blast to all eligible nearby users.
// In TEST MODE we do NOT call APNs / web-push providers — we just write the
// in-app news_items rows so the news feed works end to end.
//
// TODO(push): wire APNs (iOS) and web-push (VAPID) here once secrets are set.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const haversineMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { blast_id } = await req.json();
    if (!blast_id) {
      return new Response(JSON.stringify({ error: "missing blast_id" }), { status: 400, headers: corsHeaders });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: blast, error: bErr } = await admin
      .from("blasts").select("id, venue_id, title, body, link_url, status").eq("id", blast_id).single();
    if (bErr || !blast) throw bErr ?? new Error("blast not found");
    if (blast.status !== "paid") {
      return new Response(JSON.stringify({ error: "blast not in paid state", status: blast.status }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: venue } = await admin
      .from("bars_directory").select("lat, lng, name").eq("id", blast.venue_id).single();
    if (!venue) throw new Error("venue not found");

    // Eligible audience: anyone with a ping in the last 7 days within 1 km
    // who hasn't disabled venue blasts.
    const latD = 0.009;
    const lngD = 1 / (111 * Math.max(Math.cos((venue.lat * Math.PI) / 180), 0.01));
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pings } = await admin
      .from("user_location_pings")
      .select("user_id, lat, lng")
      .gte("seen_at", since)
      .gte("lat", venue.lat - latD).lte("lat", venue.lat + latD)
      .gte("lng", venue.lng - lngD).lte("lng", venue.lng + lngD);

    const userIds = new Set<string>();
    for (const p of pings ?? []) {
      if (haversineMeters(venue.lat, venue.lng, p.lat, p.lng) <= 1000) userIds.add(p.user_id);
    }

    if (userIds.size === 0) {
      await admin.from("blasts").update({
        status: "sent", sent_at: new Date().toISOString(), recipients_count: 0,
      }).eq("id", blast.id);
      return new Response(JSON.stringify({ ok: true, recipients: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out users who muted venue blasts.
    const { data: settings } = await admin
      .from("notification_settings").select("user_id, venue_blasts_enabled")
      .in("user_id", Array.from(userIds));
    const mutedSet = new Set((settings ?? []).filter((s) => s.venue_blasts_enabled === false).map((s) => s.user_id));
    const finalRecipients = Array.from(userIds).filter((u) => !mutedSet.has(u));

    // Insert news_items rows.
    const rows = finalRecipients.map((user_id) => ({
      user_id, venue_id: blast.venue_id, blast_id: blast.id,
      title: blast.title, body: blast.body, link_url: blast.link_url,
    }));
    if (rows.length > 0) {
      // chunk to keep payload sane
      for (let i = 0; i < rows.length; i += 500) {
        await admin.from("news_items").insert(rows.slice(i, i + 500));
      }
    }

    // TODO(push): For each recipient with a device_tokens row, send APNs push.
    // TODO(push): For each recipient with a web_push_subscriptions row, send web push.

    await admin.from("blasts").update({
      status: "sent", sent_at: new Date().toISOString(), recipients_count: rows.length,
    }).eq("id", blast.id);

    return new Response(JSON.stringify({ ok: true, recipients: rows.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});