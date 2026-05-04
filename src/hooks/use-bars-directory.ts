import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DirectoryBar {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  price_level: number | null;
  outdoor_seating: boolean | null;
  sun_timeline: SunTimelineEntry[] | null;
  timeline_date: string | null;
  sun_score_timeline: SunScoreEntry[] | null;
  orientation_deg: number | null;
  orientation_confidence: number | null;
  orientation_method: string | null;
}

export interface SunTimelineEntry {
  hour: number;
  sunlit: boolean;
  sun_elev: number;
  sun_az: number;
}

export interface SunScoreEntry {
  hour: number;
  s_direct: number;
  s_angle: number;
  s_duration: number;
  s_comfort: number;
  base_score: number;
  minutes_of_sun_left: number;
}

export const useBarsDirectory = () => {
  const [bars, setBars] = useState<DirectoryBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bars_directory")
        .select("id, name, address, lat, lng, rating, price_level, outdoor_seating, sun_timeline, timeline_date, sun_score_timeline, orientation_deg, orientation_confidence, orientation_method")
        .limit(500);
      if (cancelled) return;
      setBars((data ?? []) as unknown as DirectoryBar[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { bars, loading };
};