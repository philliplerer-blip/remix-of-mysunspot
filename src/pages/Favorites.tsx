import { Heart, Sparkles, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { BarCard } from "@/components/BarCard";
import { SpotCard } from "@/components/SpotCard";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useCustomSpots } from "@/hooks/use-custom-spots";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { bars } from "@/lib/bars";

const Favorites = () => {
  const { signOut } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const { spots, removeSpot } = useCustomSpots();
  const { settings, update } = useNotificationSettings();
  const savedBars = bars.filter((bar) => favorites.includes(bar.id));
  const totalTargets = savedBars.length + spots.length;

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-4 text-foreground sm:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-butter/60 bg-background shadow-panel animate-rise-in">
        <header className="bg-espresso px-5 pb-5 pt-3 text-secondary">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
            <span>Settings & Favorites</span>
            <button onClick={signOut} className="flex items-center gap-1 hover:text-secondary">
              <LogOut className="size-3" /> Sign out
            </button>
          </div>
          <div className="mt-4">
            <p className="flex items-center gap-1 text-xs font-medium text-flame">
              <Sparkles className="size-3" /> Your sunny shortlist
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-normal text-secondary">
              Settings & Favorites
            </h1>
            <p className="text-xs text-muted-foreground">
              {totalTargets} bookmarked {totalTargets === 1 ? "spot" : "spots"}
            </p>
          </div>
        </header>

        <section className="flex-1 space-y-4 bg-background px-4 py-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SettingsIcon className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">Sun alerts</p>
                  <p className="text-xs text-muted-foreground">Ping me when a favorite turns sunny</p>
                </div>
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
          </div>

          <div>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Favorites
            </h2>
            {totalTargets === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                <div className="space-y-3">
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-sun-gradient text-2xl shadow-sun">
                    <Heart className="size-6 text-espresso" />
                  </div>
                  <p className="font-semibold">No favorites yet</p>
                  <p className="text-sm text-muted-foreground">
                    Tap the heart on any bar to bookmark it here.
                  </p>
                  <Button asChild variant="sun" size="sm">
                    <Link to="/">Discover bars</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {savedBars.map((bar) => (
                  <BarCard
                    key={bar.id}
                    bar={bar}
                    isFavorite
                    onToggleFavorite={() => toggleFavorite(bar.id)}
                  />
                ))}
                {spots.map((spot) => (
                  <SpotCard key={spot.id} spot={spot} onRemove={() => removeSpot(spot.id)} />
                ))}
              </div>
            )}
          </div>
        </section>

        <BottomNav favoritesCount={totalTargets} />
      </section>
    </main>
  );
};

export default Favorites;
