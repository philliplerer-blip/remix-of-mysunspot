// Polls Open-Meteo for each user's favorite bars + custom spots and inserts a
// row into sun_alerts whenever sun probability crosses the user's threshold.
// Dedupes via cooldown_minutes and respects quiet hours.
//
// Triggers:
//   POST { user_id?: string }   - check one user (manual "check now")
//   POST {}                     - check all users (cron)
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Target {
  kind: "bar" | "spot";
  ref: string;
  name: string;
  lat: number;
  lng: number;
  alerts_enabled: boolean;
}

interface Settings {
  enabled: boolean;
  threshold_pct: number;
  cooldown_minutes: number;
  quiet_start_hour: number;
  quiet_end_hour: number;
}

const inQuietHours = (s: Settings, hour: number) => {
  if (s.quiet_start_hour === s.quiet_end_hour) return false;
  if (s.quiet_start_hour < s.quiet_end_hour) {
    return hour >= s.quiet_start_hour && hour < s.quiet_end_hour;
  }
  // wraps midnight, e.g. 22 → 8
  return hour >= s.quiet_start_hour || hour < s.quiet_end_hour;
};

// Open-Meteo: cloudcover for the current hour, return sun pct (100 - cloudcover).
async function fetchSunPct(lat: number, lng: number): Promise<number | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloudcover&timezone=auto`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cc = data?.current?.cloudcover;
    if (typeof cc !== "number") return null;
    return Math.max(0, Math.min(100, Math.round(100 - cc)));
  } catch {
    return null;
  }
}

async function processUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ user: string; checked: number; alerted: number; skipped: string[] }> {
  const skipped: string[] = [];

  const { data: settingsRow } = await admin
    .from("notification_settings")
    .select("enabled,threshold_pct,cooldown_minutes,quiet_start_hour,quiet_end_hour")
    .eq("user_id", userId)
    .maybeSingle();
  const settings: Settings = (settingsRow as Settings) ?? {
    enabled: true,
    threshold_pct: 70,
    cooldown_minutes: 180,
    quiet_start_hour: 22,
    quiet_end_hour: 8,
  };

  if (!settings.enabled) {
    return { user: userId, checked: 0, alerted: 0, skipped: ["alerts_disabled"] };
  }
  // Server doesn't know user TZ; quiet hours use server hour. Good enough for now.
  const nowHour = new Date().getUTCHours();
  if (inQuietHours(settings, nowHour)) {
    return { user: userId, checked: 0, alerted: 0, skipped: ["quiet_hours"] };
  }

  const [{ data: favBars }, { data: spots }] = await Promise.all([
    admin
      .from("favorite_bars")
      .select("bar_id,bar_name,lat,lng,alerts_enabled")
      .eq("user_id", userId),
    admin
      .from("custom_spots")
      .select("id,name,lat,lng,alerts_enabled")
      .eq("user_id", userId),
  ]);

  const targets: Target[] = [
    ...((favBars ?? []).map((r: any) => ({
      kind: "bar" as const,
      ref: String(r.bar_id),
      name: r.bar_name,
      lat: r.lat,
      lng: r.lng,
      alerts_enabled: r.alerts_enabled,
    }))),
    ...((spots ?? []).map((r: any) => ({
      kind: "spot" as const,
      ref: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      alerts_enabled: r.alerts_enabled,
    }))),
  ].filter((t) => t.alerts_enabled);

  let alerted = 0;
  const cooldownMs = settings.cooldown_minutes * 60_000;

  for (const t of targets) {
    const sunPct = await fetchSunPct(t.lat, t.lng);
    if (sunPct == null) continue;
    if (sunPct < settings.threshold_pct) continue;

    // dedup: skip if we alerted same target within cooldown
    const since = new Date(Date.now() - cooldownMs).toISOString();
    const { data: recent } = await admin
      .from("sun_alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("target_kind", t.kind)
      .eq("target_ref", t.ref)
      .gte("sent_at", since)
      .limit(1);
    if (recent && recent.length > 0) continue;

    await admin.from("sun_alerts").insert({
      user_id: userId,
      target_kind: t.kind,
      target_ref: t.ref,
      target_name: t.name,
      sun_pct: sunPct,
    });
    alerted++;
    // (Native push send would happen here once APNs/FCM is wired.)
  }

  return { user: userId, checked: targets.length, alerted, skipped };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  let body: { user_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let userIds: string[] = [];
  if (body.user_id) {
    userIds = [body.user_id];
  } else {
    // pull every user that has at least one favorite or spot
    const [{ data: a }, { data: b }] = await Promise.all([
      admin.from("favorite_bars").select("user_id"),
      admin.from("custom_spots").select("user_id"),
    ]);
    const set = new Set<string>();
    (a ?? []).forEach((r: any) => set.add(r.user_id));
    (b ?? []).forEach((r: any) => set.add(r.user_id));
    userIds = [...set];
  }

  const results = [];
  for (const id of userIds) {
    try {
      results.push(await processUser(admin, id));
    } catch (e) {
      results.push({ user: id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
