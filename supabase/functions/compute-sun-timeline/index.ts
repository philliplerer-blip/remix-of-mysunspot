// Computes hourly sun/shade timeline for each venue in bars_directory.
// Uses SunCalc for sun position + OpenStreetMap building footprints (Overpass API)
// to estimate whether each building blocks the sun for a given hour.
//
// Output stored on bars_directory.sun_timeline as JSON array of length 24:
//   [{ hour: 0..23, sunlit: boolean, sun_elev: number, sun_az: number }]
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import SunCalc from "npm:suncalc@1.9.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Building {
  // polygon vertices in lat/lng
  pts: Array<{ lat: number; lng: number }>;
  height: number; // meters
}

const DEFAULT_HEIGHT_M = 12; // ~4 floors fallback
const FLOOR_HEIGHT_M = 3;
const SEARCH_RADIUS_M = 250; // around each venue
const AZ_TOLERANCE_DEG = 4; // how wide a "ray" we test
const CLUSTER_FETCH_RADIUS_M = 500; // larger so neighbouring venues share cache
const CACHE_TTL_DAYS = 30;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hashBuildings(buildings: Building[]): Promise<string> {
  // Stable, compact representation: sorted by first-vertex lat,lng then height.
  const norm = buildings
    .map((b) => ({
      h: Math.round(b.height * 10) / 10,
      p: b.pts.map((p) => [Math.round(p.lat * 1e6), Math.round(p.lng * 1e6)]),
    }))
    .sort((a, b) => {
      const ax = a.p[0]?.[0] ?? 0, ay = a.p[0]?.[1] ?? 0;
      const bx = b.p[0]?.[0] ?? 0, by = b.p[0]?.[1] ?? 0;
      return ax - bx || ay - by || a.h - b.h;
    });
  return sha256Hex(JSON.stringify(norm));
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function bearingDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angDiff(a: number, b: number) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function parseHeight(tags: Record<string, string>): number {
  if (tags.height) {
    const h = parseFloat(tags.height);
    if (!isNaN(h)) return h;
  }
  if (tags["building:levels"]) {
    const l = parseFloat(tags["building:levels"]);
    if (!isNaN(l)) return l * FLOOR_HEIGHT_M;
  }
  return DEFAULT_HEIGHT_M;
}

async function fetchBuildingsFromOverpass(centerLat: number, centerLng: number, radiusM: number): Promise<Building[]> {
  // Overpass: buildings as ways with full geometry
  const query = `[out:json][timeout:60];
(way["building"](around:${radiusM},${centerLat},${centerLng}););
out tags geom;`;
  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];
  let res: Response | null = null;
  let lastErr = "";
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "sunny-bars-app/1.0",
        },
        body: "data=" + encodeURIComponent(query),
      });
      if (r.ok) { res = r; break; }
      lastErr = `${ep} ${r.status}`;
      await r.text();
    } catch (e) {
      lastErr = `${ep} ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  if (!res) throw new Error(`Overpass failed: ${lastErr}`);
  const data = await res.json();
  const buildings: Building[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== "way" || !el.geometry) continue;
    const pts = el.geometry.map((p: any) => ({ lat: p.lat, lng: p.lon }));
    if (pts.length < 3) continue;
    buildings.push({ pts, height: parseHeight(el.tags ?? {}) });
  }
  return buildings;
}

/**
 * Returns buildings for a cluster, using overpass_buildings_cache when fresh.
 * Falls back to Overpass and writes the result back into the cache.
 */
async function getBuildingsCached(
  admin: ReturnType<typeof createClient>,
  tileKey: string,
  centerLat: number,
  centerLng: number,
  radiusM: number,
  force: boolean,
): Promise<{ buildings: Building[]; hash: string; fromCache: boolean }> {
  if (!force) {
    const { data: row } = await admin
      .from("overpass_buildings_cache")
      .select("buildings, buildings_hash, expires_at, radius_m")
      .eq("tile_key", tileKey)
      .maybeSingle();
    if (
      row &&
      row.radius_m >= radiusM &&
      new Date(row.expires_at as string).getTime() > Date.now()
    ) {
      return {
        buildings: row.buildings as Building[],
        hash: row.buildings_hash as string,
        fromCache: true,
      };
    }
  }

  const buildings = await fetchBuildingsFromOverpass(centerLat, centerLng, radiusM);
  const hash = await hashBuildings(buildings);
  const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 86400 * 1000).toISOString();
  await admin
    .from("overpass_buildings_cache")
    .upsert(
      {
        tile_key: tileKey,
        lat: centerLat,
        lng: centerLng,
        radius_m: radiusM,
        buildings,
        buildings_hash: hash,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "tile_key" },
    );
  return { buildings, hash, fromCache: false };
}

function isSunlit(
  venue: { lat: number; lng: number },
  sunAz: number,
  sunElev: number,
  buildings: Building[],
): boolean {
  if (sunElev <= 0) return false;
  const tanElev = Math.tan((sunElev * Math.PI) / 180);
  for (const b of buildings) {
    for (const v of b.pts) {
      const d = haversine(venue, v);
      if (d < 1 || d > SEARCH_RADIUS_M) continue;
      const bearing = bearingDeg(venue, v);
      if (angDiff(bearing, sunAz) > AZ_TOLERANCE_DEG) continue;
      // required elevation to clear this point
      const required = b.height / d;
      if (tanElev < required) return false;
    }
  }
  return true;
}

function computeTimeline(
  venue: { lat: number; lng: number },
  date: Date,
  buildings: Building[],
) {
  const out: Array<{ hour: number; sunlit: boolean; sun_elev: number; sun_az: number }> = [];
  for (let h = 0; h < 24; h++) {
    const t = new Date(date);
    t.setUTCHours(h, 0, 0, 0);
    const pos = SunCalc.getPosition(t, venue.lat, venue.lng);
    const elev = (pos.altitude * 180) / Math.PI;
    // SunCalc azimuth: from south, clockwise. Convert to compass (from north).
    const az = (((pos.azimuth * 180) / Math.PI) + 180 + 360) % 360;
    const sunlit = isSunlit(venue, az, elev, buildings);
    out.push({
      hour: h,
      sunlit,
      sun_elev: Math.round(elev * 10) / 10,
      sun_az: Math.round(az * 10) / 10,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  let body: { force?: boolean; limit?: number; offset?: number } = {};
  try { body = await req.json(); } catch {}

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  let q = admin
    .from("bars_directory")
    .select("id, lat, lng, timeline_date, timeline_inputs_hash")
    .order("name");
  if (body.limit) {
    const from = body.offset ?? 0;
    q = q.range(from, from + body.limit - 1);
  }
  const { data: venues, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cluster venues to share Overpass calls. Simple grid by ~0.005° (~500m).
  type Cluster = {
    key: string;
    lat: number;
    lng: number;
    buildings?: Building[];
    hash?: string;
    fromCache?: boolean;
  };
  const clusters = new Map<string, Cluster>();
  for (const v of venues ?? []) {
    const k = `${Math.round(v.lat / 0.005)}_${Math.round(v.lng / 0.005)}`;
    if (!clusters.has(k)) {
      clusters.set(k, { key: k, lat: v.lat, lng: v.lng });
    }
  }

  // Resolve buildings per cluster with limited concurrency (Overpass is slow).
  let cacheHits = 0;
  let cacheMisses = 0;
  const clusterList = Array.from(clusters.values());
  const CONCURRENCY = 4;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < clusterList.length) {
        const c = clusterList[cursor++];
        try {
          const got = await getBuildingsCached(
            admin,
            c.key,
            c.lat,
            c.lng,
            CLUSTER_FETCH_RADIUS_M,
            !!body.force,
          );
          c.buildings = got.buildings;
          c.hash = got.hash;
          c.fromCache = got.fromCache;
          if (got.fromCache) cacheHits++; else cacheMisses++;
        } catch (e) {
          console.error("overpass failed", c.key, e);
          c.buildings = [];
          c.hash = "empty";
        }
      }
    }),
  );

  let processed = 0;
  let skipped = 0;
  for (const v of venues ?? []) {
    const k = `${Math.round(v.lat / 0.005)}_${Math.round(v.lng / 0.005)}`;
    const cluster = clusters.get(k);
    const buildings = cluster?.buildings ?? [];
    const clusterHash = cluster?.hash ?? "empty";
    // Inputs hash: anything that, if changed, must invalidate the cached trajectory.
    const inputsHash = await sha256Hex(
      `${v.lat.toFixed(6)}|${v.lng.toFixed(6)}|${todayStr}|${clusterHash}`,
    );
    if (
      !body.force &&
      v.timeline_date === todayStr &&
      v.timeline_inputs_hash === inputsHash
    ) {
      skipped++;
      continue;
    }
    // Filter to those within radius for this venue
    const near = buildings.filter((b) =>
      b.pts.some((p) => haversine({ lat: v.lat, lng: v.lng }, p) <= SEARCH_RADIUS_M),
    );
    const timeline = computeTimeline({ lat: v.lat, lng: v.lng }, today, near);
    await admin
      .from("bars_directory")
      .update({
        sun_timeline: timeline,
        timeline_date: todayStr,
        timeline_computed_at: new Date().toISOString(),
        timeline_inputs_hash: inputsHash,
      })
      .eq("id", v.id);
    processed++;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed,
      skipped,
      clusters: clusters.size,
      cache_hits: cacheHits,
      cache_misses: cacheMisses,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});