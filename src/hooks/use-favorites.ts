import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bars } from "@/lib/bars";
import { useAuth } from "@/hooks/use-auth";

export const useFavorites = () => {
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setHydrated(true);
      return;
    }
    const { data } = await supabase
      .from("favorite_bars")
      .select("bar_id")
      .eq("user_id", user.id);
    setFavorites((data ?? []).map((r) => r.bar_id as number));
    setHydrated(true);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [refresh, authLoading]);

  // Realtime cross-tab sync
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`fav-bars-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorite_bars", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const toggleFavorite = async (id: number) => {
    if (!user) return;
    const isFav = favorites.includes(id);
    if (isFav) {
      setFavorites((cur) => cur.filter((i) => i !== id));
      await supabase.from("favorite_bars").delete().eq("user_id", user.id).eq("bar_id", id);
    } else {
      const bar = bars.find((b) => b.id === id);
      if (!bar) return;
      setFavorites((cur) => [...cur, id]);
      await supabase.from("favorite_bars").insert({
        user_id: user.id,
        bar_id: id,
        bar_name: bar.name,
        lat: bar.lat,
        lng: bar.lng,
      });
    }
  };

  return { favorites, toggleFavorite, hydrated };
};
