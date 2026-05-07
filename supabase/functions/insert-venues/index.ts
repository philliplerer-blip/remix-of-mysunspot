import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Venue {
  google_place_id: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  outdoor_seating?: boolean | null;
  outdoor_source?: string;
  types?: string[];
  keywords_matched?: string[];
  last_refreshed_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const venues: Venue[] = Array.isArray(body?.venues) ? body.venues : [];

    if (venues.length === 0) {
      return new Response(
        JSON.stringify({ error: "venues array is required and non-empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const v of venues) {
      if (
        !v.google_place_id ||
        typeof v.name !== "string" ||
        typeof v.lat !== "number" ||
        typeof v.lng !== "number"
      ) {
        return new Response(
          JSON.stringify({ error: "each venue must have google_place_id, name, lat, lng" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rows = venues.map((v) => ({
      google_place_id: v.google_place_id,
      name: v.name,
      address: v.address ?? null,
      lat: v.lat,
      lng: v.lng,
      outdoor_seating: v.outdoor_seating ?? null,
      outdoor_source: v.outdoor_source ?? "none",
      types: v.types ?? [],
      keywords_matched: v.keywords_matched ?? [],
      last_refreshed_at: v.last_refreshed_at ?? new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("bars_directory")
      .upsert(rows, { onConflict: "google_place_id" })
      .select("id");

    if (error) {
      console.error("upsert error", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, count: data?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});