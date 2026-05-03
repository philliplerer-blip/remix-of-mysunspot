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
}

export const useBarsDirectory = () => {
  const [bars, setBars] = useState<DirectoryBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bars_directory")
        .select("id, name, address, lat, lng, rating, price_level, outdoor_seating")
        .limit(500);
      if (cancelled) return;
      setBars((data ?? []) as DirectoryBar[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { bars, loading };
};