// Returns the Google Maps JS API key for the frontend.
// The key is restricted by HTTP referrer in Google Cloud Console, so exposing
// it to the browser is safe.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
  return new Response(JSON.stringify({ apiKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});