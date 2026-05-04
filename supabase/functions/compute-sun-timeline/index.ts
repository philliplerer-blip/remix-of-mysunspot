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
const ORIENTATION_RAY_MAX_M = 200; // cap for open-ray distance probe
const ORIENTATION_RAY_STEP_M = 10;
const ORIENTATION_RAY_COUNT = 36; // 10° steps for open-ray fallback
const SCORE_VERSION = "v1"; // bump to invalidate cached scores

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

// Move a lat/lng point by `distM` meters along compass `bearingDeg`.
function moveMeters(
  origin: { lat: number; lng: number },
  bearingDeg: number,
  distM: number,
): { lat: number; lng: number } {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const φ1 = (origin.lat * Math.PI) / 180;
  const λ1 = (origin.lng * Math.PI) / 180;
  const dr = distM / R;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(dr) + Math.cos(φ1) * Math.sin(dr) * Math.cos(br),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(br) * Math.sin(dr) * Math.cos(φ1),
      Math.cos(dr) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
}

// Standard ray/segment intersection in (x=lng, y=lat) approximate planar space.
// Good enough for ~hundreds of meters in a city.
function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return false;
  const s = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const t = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

function pointInPolygon(
  point: { lat: number; lng: number },
  poly: Array<{ lat: number; lng: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Cast a ray outward from `venue` along compass `bearing` and return the
 * distance (m) to the first building edge it hits, capped at `maxM`.
 */
function rayDistanceToBuilding(
  venue: { lat: number; lng: number },
  bearing: number,
  buildings: Building[],
  maxM = ORIENTATION_RAY_MAX_M,
): number {
  const end = moveMeters(venue, bearing, maxM);
  const p1 = { x: venue.lng, y: venue.lat };
  const p2 = { x: end.lng, y: end.lat };
  let best = maxM;
  for (const b of buildings) {
    for (let i = 0; i < b.pts.length; i++) {
      const a = b.pts[i];
      const c = b.pts[(i + 1) % b.pts.length];
      const p3 = { x: a.lng, y: a.lat };
      const p4 = { x: c.lng, y: c.lat };
      if (!segmentsIntersect(p1, p2, p3, p4)) continue;
      // Approximate hit distance: midpoint of edge to venue.
      const midLat = (a.lat + c.lat) / 2;
      const midLng = (a.lng + c.lng) / 2;
      const d = haversine(venue, { lat: midLat, lng: midLng });
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Estimate which direction the bar's outdoor seating likely faces.
 *
 * Strategy:
 *  1. Find a building containing (or closest to) the venue. Walk its edges,
 *     compute outward normals, and probe each with a ray. Pick the longest.
 *  2. If no containing building or scores are weak, fall back to a 36-direction
 *     open-ray scan around the bar and pick the longest unobstructed bearing.
 *
 * Confidence = (best - mean) / best, clamped to [0,1] — high when one direction
 * dominates, low when several look similar.
 */
function estimateOrientation(
  venue: { lat: number; lng: number },
  buildings: Building[],
): { orientation: number; confidence: number; method: string } {
  // Step 1: try polygon-edge method.
  let containing: Building | null = null;
  for (const b of buildings) {
    if (pointInPolygon(venue, b.pts)) { containing = b; break; }
  }
  // If not inside any, pick the nearest building within ~30m (terrace abuts wall).
  if (!containing) {
    let bestD = 30;
    for (const b of buildings) {
      for (const p of b.pts) {
        const d = haversine(venue, p);
        if (d < bestD) { bestD = d; containing = b; }
      }
    }
  }

  const edgeResults: Array<{ bearing: number; dist: number }> = [];
  if (containing) {
    const pts = containing.pts;
    // Polygon centroid for inside/outside normal disambiguation.
    let cLat = 0, cLng = 0;
    for (const p of pts) { cLat += p.lat; cLng += p.lng; }
    cLat /= pts.length; cLng /= pts.length;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const c = pts[(i + 1) % pts.length];
      const midLat = (a.lat + c.lat) / 2;
      const midLng = (a.lng + c.lng) / 2;
      // Edge bearing → outward normal is edge bearing ± 90°. Pick the one
      // pointing away from the centroid.
      const edgeBear = bearingDeg({ lat: a.lat, lng: a.lng }, { lat: c.lat, lng: c.lng });
      const n1 = (edgeBear + 90) % 360;
      const n2 = (edgeBear + 270) % 360;
      const probe1 = moveMeters({ lat: midLat, lng: midLng }, n1, 5);
      const probe2 = moveMeters({ lat: midLat, lng: midLng }, n2, 5);
      const d1 = haversine({ lat: cLat, lng: cLng }, probe1);
      const d2 = haversine({ lat: cLat, lng: cLng }, probe2);
      const outward = d1 >= d2 ? n1 : n2;
      // Cast from a point a few meters outside the wall along the normal.
      const start = moveMeters({ lat: midLat, lng: midLng }, outward, 3);
      const dist = rayDistanceToBuilding(start, outward, buildings);
      edgeResults.push({ bearing: outward, dist });
    }
  }

  // Pick best edge result if it dominates.
  if (edgeResults.length > 0) {
    edgeResults.sort((a, b) => b.dist - a.dist);
    const best = edgeResults[0];
    const mean =
      edgeResults.reduce((s, r) => s + r.dist, 0) / edgeResults.length;
    const confidence = best.dist > 0 ? Math.max(0, Math.min(1, (best.dist - mean) / best.dist)) : 0;
    if (best.dist >= 15) {
      return {
        orientation: Math.round(best.bearing * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        method: "polygon_edge",
      };
    }
  }

  // Step 2: open-ray fallback — 36 bearings around the venue.
  const rays: Array<{ bearing: number; dist: number }> = [];
  for (let i = 0; i < ORIENTATION_RAY_COUNT; i++) {
    const bearing = (i * 360) / ORIENTATION_RAY_COUNT;
    rays.push({ bearing, dist: rayDistanceToBuilding(venue, bearing, buildings) });
  }
  rays.sort((a, b) => b.dist - a.dist);
  const best = rays[0];
  const mean = rays.reduce((s, r) => s + r.dist, 0) / rays.length;
  const confidence = best.dist > 0 ? Math.max(0, Math.min(1, (best.dist - mean) / best.dist)) : 0;
  return {
    orientation: Math.round(best.bearing * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    method: "open_ray",
  };
}

/**
 * Per-hour partial sun score. Weather is applied client-side at render time
 * so the cached score doesn't go stale when clouds change.
 *
 * Returns components in 0..1 plus a base score (no weather) in 0..100, using
 * the spec's weights with cloudFactor = 1 (clear-sky baseline).
 */
function scoreComponents(
  sunlit: boolean,
  sunElev: number,
  sunAz: number,
  orientation: number,
  minutesOfSunLeft: number,
) {
  const sDirect = sunlit && sunElev > 0 ? 1 : 0;
  const angleDiffDeg = angDiff(sunAz, orientation); // 0..180
  const sAngle = sDirect ? Math.max(0, Math.cos((angleDiffDeg * Math.PI) / 180)) : 0;
  const sDuration = Math.min(1, Math.max(0, minutesOfSunLeft) / 120);
  let sComfort = 0.6;
  if (sunElev > 0 && sunElev < 10) sComfort = 0.3;
  else if (sunElev >= 10 && sunElev <= 45) sComfort = 1.0;
  // Clear-sky baseline (cloudFactor=1). Final score combines weather client-side.
  const baseScore =
    100 * (0.35 * sDirect + 0.25 * sAngle + 0.2 * sDuration + 0.2 * sComfort);
  return {
    s_direct: sDirect,
    s_angle: Math.round(sAngle * 1000) / 1000,
    s_duration: Math.round(sDuration * 1000) / 1000,
    s_comfort: Math.round(sComfort * 1000) / 1000,
    base_score: Math.round(baseScore * 10) / 10,
  };
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

function buildScoreTimeline(
  timeline: Array<{ hour: number; sunlit: boolean; sun_elev: number; sun_az: number }>,
  orientation: number,
) {
  // Precompute remaining sunlit minutes per hour (forward simulation in 60-min steps).
  // For each hour h, count consecutive future hours (incl. h) where sunlit && elev>0.
  const remaining: number[] = new Array(timeline.length).fill(0);
  for (let i = timeline.length - 1; i >= 0; i--) {
    const e = timeline[i];
    const lit = e.sunlit && e.sun_elev > 0;
    remaining[i] = lit ? (remaining[i + 1] ?? 0) + 60 : 0;
  }
  return timeline.map((e, i) => {
    const c = scoreComponents(e.sunlit, e.sun_elev, e.sun_az, orientation, remaining[i]);
    return { hour: e.hour, ...c, minutes_of_sun_left: remaining[i] };
  });
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
      `${SCORE_VERSION}|${v.lat.toFixed(6)}|${v.lng.toFixed(6)}|${todayStr}|${clusterHash}`,
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
    const orient = estimateOrientation({ lat: v.lat, lng: v.lng }, near);
    const scoreTimeline = buildScoreTimeline(timeline, orient.orientation);
    await admin
      .from("bars_directory")
      .update({
        sun_timeline: timeline,
        sun_score_timeline: scoreTimeline,
        orientation_deg: orient.orientation,
        orientation_confidence: orient.confidence,
        orientation_method: orient.method,
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