// Refreshes the bars_directory table from Google Places API (NEW v1)
// Area: Copenhagen city center, ~3km radius
// Uses Places API (New) — https://places.googleapis.com — which exposes
// the native `outdoorSeating` boolean. Falls back to keyword inference
// from editorialSummary / reviews when the API field is missing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CENTER = { lat: 55.6833, lng: 12.5833 };
const RADIUS_M = 3000;

// Cache TTL: skip Google Places calls for tiles fetched within this window.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// Tile precision for cache keys: 2 decimals ≈ ~1.1km at CPH latitude.
const TILE_PRECISION = 100;
const tileKey = (lat: number, lng: number, radius: number) =>
  `${Math.round(lat * TILE_PRECISION) / TILE_PRECISION},${Math.round(lng * TILE_PRECISION) / TILE_PRECISION}@${radius}`;

const OUTDOOR_KEYWORDS = [
  "outdoor", "outdoor seating", "terrace", "terrasse",
  "rooftop", "beer garden", "biergarten", "patio",
  "udeservering", "garden", "courtyard", "sidewalk",
];

interface PlaceV1 {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string; // PRICE_LEVEL_MODERATE etc.
  types?: string[];
  outdoorSeating?: boolean;
  editorialSummary?: { text?: string };
  reviews?: { text?: { text?: string } }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.outdoorSeating",
  "places.editorialSummary",
  "places.reviews",
].join(",");

const INCLUDED_TYPES = [
  "bar",
  "pub",
  "wine_bar",
  "cafe",
  "restaurant",
  "bakery",
  "ice_cream_shop",
];

async function searchNearby(
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  force: boolean,
): Promise<{ places: PlaceV1[]; tilesHit: number; tilesSkipped: number }> {
  // Places API (New) searchNearby returns up to 20 results per call
  // and does not support pagination. To get more coverage, we issue
  // multiple calls over a 3x3 sub-grid covering the radius.
  const all = new Map<string, PlaceV1>();
  const offsets = [-0.012, 0, 0.012]; // ~1.3 km in lat / lng at CPH latitude
  const subRadius = 1500;
  let tilesHit = 0;
  let tilesSkipped = 0;

  // Load existing cache rows in one query
  const tiles = offsets.flatMap((dLat) =>
    offsets.map((dLng) => ({
      lat: CENTER.lat + dLat,
      lng: CENTER.lng + dLng,
      key: tileKey(CENTER.lat + dLat, CENTER.lng + dLng, subRadius),
    })),
  );
  const { data: cacheRows } = await supabase
    .from("places_fetch_cache")
    .select("tile_key, last_fetched_at")
    .in("tile_key", tiles.map((t) => t.key));
  const cacheMap = new Map<string, string>(
    (cacheRows ?? []).map((r: { tile_key: string; last_fetched_at: string }) => [r.tile_key, r.last_fetched_at]),
  );

  for (const tile of tiles) {
    const lastTs = cacheMap.get(tile.key);
    const fresh = lastTs && Date.now() - new Date(lastTs).getTime() < CACHE_TTL_MS;
    if (fresh && !force) {
      tilesSkipped++;
      continue;
    }
    const body = {
      includedTypes: INCLUDED_TYPES,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: tile.lat, longitude: tile.lng },
          radius: subRadius,
        },
      },
    };
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Places searchNearby failed (${res.status}): ${JSON.stringify(json)}`);
    }
    const places = (json.places ?? []) as PlaceV1[];
    for (const place of places) {
      if (place.id) all.set(place.id, place);
    }
    tilesHit++;
    await supabase.from("places_fetch_cache").upsert(
      {
        tile_key: tile.key,
        lat: tile.lat,
        lng: tile.lng,
        radius_m: subRadius,
        result_count: places.length,
        last_fetched_at: new Date().toISOString(),
      },
      { onConflict: "tile_key" },
    );
    await sleep(120);
  }
  return { places: Array.from(all.values()), tilesHit, tilesSkipped };
}


function inferOutdoorFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return OUTDOOR_KEYWORDS.filter((kw) => lower.includes(kw));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey =
      Deno.env.get("GOOGLE_PLACES_API_KEY") ??
      Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let force = false;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json();
        force = body?.force === true;
      }
    } catch { /* no body */ }

    const { places, tilesHit, tilesSkipped } = await searchNearby(apiKey, supabase, force);
    console.log(`Nearby search: ${places.length} places (tiles hit=${tilesHit}, cached=${tilesSkipped})`);

    const rows: Array<Record<string, unknown>> = [];

    for (const p of places) {
      let outdoor: boolean | null = null;
      let source: "api" | "keyword" | "none" = "none";
      let matched: string[] = [];

      if (typeof p.outdoorSeating === "boolean") {
        outdoor = p.outdoorSeating;
        source = "api";
      } else {
        const haystack = [
          p.editorialSummary?.text ?? "",
          ...(p.reviews?.slice(0, 5).map((r) => r.text?.text ?? "") ?? []),
          (p.types ?? []).join(" "),
          p.displayName?.text ?? "",
        ].join(" \n ");
        matched = inferOutdoorFromText(haystack);
        if (matched.length > 0) {
          outdoor = true;
          source = "keyword";
        }
      }

      // priceLevel comes back as PRICE_LEVEL_MODERATE etc. in v1
      const priceMap: Record<string, number> = {
        PRICE_LEVEL_FREE: 0,
        PRICE_LEVEL_INEXPENSIVE: 1,
        PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3,
        PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };

      rows.push({
        google_place_id: p.id,
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress ?? p.shortFormattedAddress ?? null,
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
        rating: p.rating ?? null,
        user_ratings_total: p.userRatingCount ?? null,
        price_level: p.priceLevel ? priceMap[p.priceLevel] ?? null : null,
        outdoor_seating: outdoor,
        outdoor_source: source,
        types: p.types ?? [],
        keywords_matched: matched,
        last_refreshed_at: new Date().toISOString(),
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("bars_directory")
        .upsert(rows, { onConflict: "google_place_id" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched: places.length,
        upserted: rows.length,
        tiles_fetched: tilesHit,
        tiles_cached: tilesSkipped,
        outdoor_count: rows.filter((r) => r.outdoor_seating === true).length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("refresh-bars-directory error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
