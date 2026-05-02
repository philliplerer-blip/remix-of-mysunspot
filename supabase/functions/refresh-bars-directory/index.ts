// Refreshes the bars_directory table from Google Places API (Nearby Search + Place Details)
// Area: Copenhagen city center, ~3km radius
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CENTER = { lat: 55.6833, lng: 12.5833 };
const RADIUS_M = 3000;

const OUTDOOR_KEYWORDS = [
  "outdoor", "outdoor seating", "terrace", "terrasse",
  "rooftop", "beer garden", "biergarten", "patio",
  "udeservering", "garden", "courtyard", "sidewalk",
];

interface PlaceLite {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nearbySearch(apiKey: string): Promise<PlaceLite[]> {
  const all: PlaceLite[] = [];
  let url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${CENTER.lat},${CENTER.lng}&radius=${RADIUS_M}&type=bar&key=${apiKey}`;

  for (let page = 0; page < 3; page++) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      throw new Error(`Nearby search failed: ${json.status} ${json.error_message ?? ""}`);
    }
    all.push(...(json.results ?? []));
    if (!json.next_page_token) break;
    // Google requires a short delay before next_page_token becomes valid
    await sleep(2200);
    url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?pagetoken=${json.next_page_token}&key=${apiKey}`;
  }
  return all;
}

async function placeDetails(apiKey: string, placeId: string) {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}` +
    `&fields=outdoor_seating,editorial_summary,reviews,formatted_address,name` +
    `&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "OK") return null;
  return json.result as {
    outdoor_seating?: boolean;
    editorial_summary?: { overview?: string };
    reviews?: { text?: string }[];
    formatted_address?: string;
    name?: string;
  };
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
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const places = await nearbySearch(apiKey);
    console.log(`Nearby search returned ${places.length} bars`);

    const rows: Array<Record<string, unknown>> = [];

    for (const p of places) {
      const details = await placeDetails(apiKey, p.place_id);

      let outdoor: boolean | null = null;
      let source: "api" | "keyword" | "none" = "none";
      let matched: string[] = [];

      if (typeof details?.outdoor_seating === "boolean") {
        outdoor = details.outdoor_seating;
        source = "api";
      } else {
        const haystack = [
          details?.editorial_summary?.overview ?? "",
          ...(details?.reviews?.slice(0, 5).map((r) => r.text ?? "") ?? []),
          (p.types ?? []).join(" "),
          p.name,
        ].join(" \n ");
        matched = inferOutdoorFromText(haystack);
        if (matched.length > 0) {
          outdoor = true;
          source = "keyword";
        }
      }

      rows.push({
        google_place_id: p.place_id,
        name: details?.name ?? p.name,
        address: details?.formatted_address ?? p.vicinity ?? null,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        rating: p.rating ?? null,
        user_ratings_total: p.user_ratings_total ?? null,
        price_level: p.price_level ?? null,
        outdoor_seating: outdoor,
        outdoor_source: source,
        types: p.types ?? [],
        keywords_matched: matched,
        last_refreshed_at: new Date().toISOString(),
      });

      // light pacing to stay under QPS
      await sleep(60);
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
