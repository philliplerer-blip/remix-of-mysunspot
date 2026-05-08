import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation } from "@/hooks/use-geolocation";

// Records the user's location once every 5 minutes while the app is open.
// Used by venue dashboards to count nearby users (1 km, last 7 days).
export const LocationPingTracker = () => {
  const { user } = useAuth();
  const geo = useGeolocation();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!user || geo.source !== "gps" || geo.loading) return;
    const now = Date.now();
    if (now - lastSent.current < 5 * 60 * 1000) return;
    lastSent.current = now;
    supabase.from("user_location_pings").insert({
      user_id: user.id, lat: geo.lat, lng: geo.lng,
    }).then(({ error }) => { if (error) console.warn("ping failed", error); });
  }, [user, geo.lat, geo.lng, geo.source, geo.loading]);

  return null;
};