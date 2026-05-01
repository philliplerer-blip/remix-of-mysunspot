import { useEffect, useState } from "react";
import { Bell, Sparkles, LogOut, Sun } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useCustomSpots } from "@/hooks/use-custom-spots";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AlertRow {
  id: string;
  target_kind: "bar" | "spot";
  target_name: string;
  sun_pct: number;
  sent_at: string;
  read_at: string | null;
}

const Alerts = () => {
  const { user, signOut } = useAuth();
  const { favorites } = useFavorites();
  const { spots } = useCustomSpots();
  const { settings, update } = useNotificationSettings();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [checking, setChecking] = useState(false);

  const loadAlerts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sun_alerts")
      .select("id,target_kind,target_name,sun_pct,sent_at,read_at")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(30);
    setAlerts((data ?? []) as AlertRow[]);
  };

  useEffect(() => {
    loadAlerts();
    if (!user) return;
    const channel = supabase
      .channel(`alerts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sun_alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AlertRow;
          setAlerts((cur) => [row, ...cur]);
          toast.success(`☀️ Sun is live at ${row.target_name}`, {
            description: `${row.sun_pct}% sun probability right now`,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkNow = async () => {
    setChecking(true);
    try {
      const { error } = await supabase.functions.invoke("check-sunny-spots", {
        body: { user_id: user?.id },
      });
      if (error) throw error;
      toast("Checked the forecast", { description: "Any sunny spots will appear below." });
      await loadAlerts();
    } catch (err) {
      toast.error("Could not check forecast", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setChecking(false);
    }
  };

  const totalTargets = favorites.length + spots.length;

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-4 text-foreground sm:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-butter/60 bg-background shadow-panel animate-rise-in">
        <header className="bg-espresso px-5 pb-5 pt-3 text-secondary">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
            <span>Alerts</span>
            <button onClick={signOut} className="flex items-center gap-1 hover:text-secondary">
              <LogOut className="size-3" /> Sign out
            </button>
          </div>
          <div className="mt-4">
            <p className="flex items-center gap-1 text-xs font-medium text-flame">
              <Sparkles className="size-3" /> Sun pings
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-secondary">Alerts</h1>
            <p className="text-xs text-muted-foreground">
              Watching {totalTargets} {totalTargets === 1 ? "spot" : "spots"}
            </p>
          </div>
        </header>

        <section className="flex-1 space-y-4 bg-background px-4 py-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Sun alerts</p>
                <p className="text-xs text-muted-foreground">Ping me when a favorite turns sunny</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Sun threshold · {settings.threshold_pct}%</Label>
              <Slider
                min={40}
                max={95}
                step={5}
                value={[settings.threshold_pct]}
                onValueChange={([v]) => update({ threshold_pct: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Cooldown · {settings.cooldown_minutes} min between pings per spot
              </Label>
              <Slider
                min={30}
                max={720}
                step={30}
                value={[settings.cooldown_minutes]}
                onValueChange={([v]) => update({ cooldown_minutes: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Quiet hours · {settings.quiet_start_hour}:00 – {settings.quiet_end_hour}:00
              </Label>
              <div className="flex gap-2">
                <Slider
                  min={0}
                  max={23}
                  step={1}
                  value={[settings.quiet_start_hour]}
                  onValueChange={([v]) => update({ quiet_start_hour: v })}
                />
                <Slider
                  min={0}
                  max={23}
                  step={1}
                  value={[settings.quiet_end_hour]}
                  onValueChange={([v]) => update({ quiet_end_hour: v })}
                />
              </div>
            </div>

            <Button
              variant="sun"
              size="sm"
              className="w-full"
              onClick={checkNow}
              disabled={checking || totalTargets === 0}
            >
              <Sun className="mr-2 size-4" />
              {checking ? "Checking…" : "Check forecast now"}
            </Button>
          </div>

          <div>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent pings
            </h2>
            {alerts.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                <Bell className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-semibold">No pings yet</p>
                <p className="text-xs text-muted-foreground">
                  We'll alert you the moment a favorite hits {settings.threshold_pct}% sun.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="grid size-10 place-items-center rounded-full bg-sun-gradient text-lg shadow-sun">
                      ☀️
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.target_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.sun_pct}% sun · {formatDistanceToNow(new Date(a.sent_at), { addSuffix: true })}
                      </p>
                    </div>
                    <span className="rounded-full bg-flame/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase text-flame">
                      {a.target_kind}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <BottomNav favoritesCount={favorites.length + spots.length} />
      </section>
    </main>
  );
};

export default Alerts;
