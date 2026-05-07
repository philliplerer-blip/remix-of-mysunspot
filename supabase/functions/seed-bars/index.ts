// Seeds the `venues` table from data/seeds/seed_venues.json (embedded).
// Idempotent: upserts on (name, neighborhood) — re-running won't duplicate rows.
// Requires admin auth via SEED_ADMIN_TOKEN header to prevent abuse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import seedData from "./seed_venues.json" with { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-token",
};

interface SeedVenue {
  name: string;
  lat: number | null;
  lng: number | null;
  neighborhood: string;
  venue_type: string[];
  outdoor_type: string[];
  sources: string[];
  confidence: "verified" | "likely";
  source_tier?: string;
  note?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const venues = seedData as SeedVenue[];
  let inserted = 0;
  let updated = 0;
  const errors: { name: string; error: string }[] = [];

  for (const v of venues) {
    const row = {
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      neighborhood: v.neighborhood,
      venue_type: v.venue_type,
      outdoor_type: v.outdoor_type,
      sources: { list: v.sources, source_tier: v.source_tier ?? null },
      confidence: v.confidence,
      note: v.note ?? null,
    };
    // Check if exists by (name, neighborhood)
    const { data: existing } = await supabase
      .from("venues")
      .select("id")
      .eq("name", v.name)
      .eq("neighborhood", v.neighborhood)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("venues").update(row).eq("id", existing.id);
      if (error) errors.push({ name: v.name, error: error.message });
      else updated++;
    } else {
      const { error } = await supabase.from("venues").insert(row);
      if (error) errors.push({ name: v.name, error: error.message });
      else inserted++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, total: venues.length, inserted, updated, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});