import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface OwnedVenue {
  venue_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

export const useVenueOwner = () => {
  const { user, loading: authLoading } = useAuth();
  const [venues, setVenues] = useState<OwnedVenue[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setVenues([]); setIsAdmin(false); setLoading(false); return;
    }
    let cancelled = false;
    (async () => {
      const [ownersRes, rolesRes] = await Promise.all([
        supabase
          .from("venue_owners")
          .select("venue_id, bars_directory!inner(id, name, address, lat, lng)")
          .eq("user_id", user.id),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const list: OwnedVenue[] = ((ownersRes.data ?? []) as Array<{
        venue_id: string;
        bars_directory: { id: string; name: string; address: string | null; lat: number; lng: number };
      }>).map((row) => ({
        venue_id: row.venue_id,
        name: row.bars_directory.name,
        address: row.bars_directory.address,
        lat: row.bars_directory.lat,
        lng: row.bars_directory.lng,
      }));
      setVenues(list);
      setIsAdmin((rolesRes.data ?? []).some((r) => r.role === "admin"));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { venues, isAdmin, loading, isVenueOwner: venues.length > 0 };
};