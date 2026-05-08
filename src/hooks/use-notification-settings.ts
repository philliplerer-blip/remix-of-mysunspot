import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface NotificationSettings {
  enabled: boolean;
  threshold_pct: number;
  cooldown_minutes: number;
  quiet_start_hour: number;
  quiet_end_hour: number;
  venue_blasts_enabled: boolean;
}

const DEFAULTS: NotificationSettings = {
  enabled: true,
  threshold_pct: 70,
  cooldown_minutes: 180,
  quiet_start_hour: 22,
  quiet_end_hour: 8,
  venue_blasts_enabled: true,
};

export const useNotificationSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_settings")
      .select("enabled,threshold_pct,cooldown_minutes,quiet_start_hour,quiet_end_hour,venue_blasts_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setSettings(data as NotificationSettings);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = async (patch: Partial<NotificationSettings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from("notification_settings").upsert({ user_id: user.id, ...next });
  };

  return { settings, loaded, update };
};
