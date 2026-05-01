import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  type CustomSpot,
  type SpotIcon,
  MAP_CENTER,
  MAP_SPAN,
  xyToLatLng,
} from "@/lib/spots";

type Row = {
  id: string;
  name: string;
  note: string;
  icon: string;
  lat: number;
  lng: number;
  created_at: string;
};

const rowToSpot = (r: Row): CustomSpot => {
  const x = ((r.lng - MAP_CENTER.lng) / MAP_SPAN.lng + 0.5) * 100;
  const y = (0.5 - (r.lat - MAP_CENTER.lat) / MAP_SPAN.lat) * 100;
  return {
    id: r.id,
    name: r.name,
    note: r.note ?? "",
    icon: (r.icon as SpotIcon) ?? "other",
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
    lat: r.lat,
    lng: r.lng,
    createdAt: new Date(r.created_at).getTime(),
  };
};

export const useCustomSpots = () => {
  const { user, loading: authLoading } = useAuth();
  const [spots, setSpots] = useState<CustomSpot[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setSpots([]);
      return;
    }
    const { data } = await supabase
      .from("custom_spots")
      .select("id,name,note,icon,lat,lng,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSpots((data ?? []).map((r) => rowToSpot(r as Row)));
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [refresh, authLoading]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`spots-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_spots", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const addSpot = async (spot: Omit<CustomSpot, "id" | "createdAt" | "lat" | "lng">) => {
    if (!user) return null;
    const { lat, lng } = xyToLatLng(spot.x, spot.y);
    const { data } = await supabase
      .from("custom_spots")
      .insert({ user_id: user.id, name: spot.name, note: spot.note, icon: spot.icon, lat, lng })
      .select("id,name,note,icon,lat,lng,created_at")
      .single();
    if (data) {
      const created = rowToSpot(data as Row);
      setSpots((cur) => [created, ...cur]);
      return created;
    }
    return null;
  };

  const removeSpot = async (id: string) => {
    if (!user) return;
    setSpots((cur) => cur.filter((s) => s.id !== id));
    await supabase.from("custom_spots").delete().eq("id", id);
  };

  const updateSpot = async (
    id: string,
    updates: Partial<Pick<CustomSpot, "name" | "note" | "icon">>,
  ) => {
    if (!user) return;
    setSpots((cur) => cur.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    await supabase.from("custom_spots").update(updates).eq("id", id);
  };

  return { spots, addSpot, removeSpot, updateSpot };
};
