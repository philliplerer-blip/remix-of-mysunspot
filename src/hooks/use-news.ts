import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  venue_id: string;
  created_at: string;
  read_at: string | null;
}

export const useNews = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("news_items")
      .select("id, title, body, link_url, venue_id, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as NewsItem[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const markRead = async (id: string) => {
    await supabase.from("news_items").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  const unreadCount = items.filter((n) => !n.read_at).length;
  return { items, loading, refresh, markRead, unreadCount };
};