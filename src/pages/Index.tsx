import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Heart, LocateFixed, Navigation, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarCard } from "@/components/BarCard";
import { BottomNav } from "@/components/BottomNav";
import { AddSpotDialog } from "@/components/AddSpotDialog";
import { MapView } from "@/components/MapView";
import { useFavorites } from "@/hooks/use-favorites";
import { useCustomSpots } from "@/hooks/use-custom-spots";
import { useBarsDirectory } from "@/hooks/use-bars-directory";
import { useWeather } from "@/hooks/use-weather";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { DirectoryBar } from "@/hooks/use-bars-directory";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Star, TreePine } from "lucide-react";
import { Filter, bars, filters, stateCopy, type Bar, type SunState } from "@/lib/bars";
import { MAP_CENTER, MAP_SPAN, type CustomSpot, type SpotIcon } from "@/lib/spots";
import { cn } from "@/lib/utils";

const iconForCloud = (cloud: number, isDay: boolean) => {
  if (!isDay) return "🌙";
  if (cloud < 20) return "☀️";
  if (cloud < 50) return "🌤️";
  if (cloud < 80) return "⛅";
  return "🌥️";
};

const Index = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const { favorites, toggleFavorite } = useFavorites();
  const { spots, addSpot, removeSpot, updateSpot } = useCustomSpots();
  const { bars: directoryBars } = useBarsDirectory();
  const geo = useGeolocation();
  const weather = useWeather(geo.lat, geo.lng);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const nowHour = now.getHours();
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  const barsInView = useMemo(() => {
    if (!mapBounds) return directoryBars;
    return directoryBars.filter(
      (b) =>
        b.lat <= mapBounds.north &&
        b.lat >= mapBounds.south &&
        b.lng <= mapBounds.east &&
        b.lng >= mapBounds.west,
    );
  }, [directoryBars, mapBounds]);

  const directoryBarsAsBars = useMemo<Bar[]>(() => {
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const currentHour = new Date().getHours();
    return barsInView.map((b, idx) => {
      const tl = (b.sun_timeline ?? []) as Array<{ hour: number; sunlit: boolean; sun_elev: number }>;
      const sunHours = tl.filter((e) => e.sun_elev > 0 && e.sunlit).map((e) => e.hour);
      const start = sunHours.length ? sunHours[0] : 12;
      const end = sunHours.length ? sunHours[sunHours.length - 1] + 1 : 18;
      let state: SunState = "shade";
      if (sunHours.includes(currentHour)) state = "sun";
      else if (sunHours.some((h) => h > currentHour)) state = "soon";
      const dKm = haversineKm(MAP_CENTER.lat, MAP_CENTER.lng, b.lat, b.lng);
      const dist = dKm < 1 ? `${Math.round(dKm * 1000)} m` : `${dKm.toFixed(1)} km`;
      const priceKr = b.price_level != null ? 50 + b.price_level * 15 : 65;
      return {
        id: idx,
        name: b.name,
        area: b.address?.split(",")[0] ?? "Copenhagen",
        state,
        beer: priceKr,
        dist,
        start,
        end,
        x: 50,
        y: 50,
        vibe: b.outdoor_seating ? "Outdoor seating" : "Indoor venue",
        lat: b.lat,
        lng: b.lng,
      };
    });
  }, [barsInView]);

  const findNearestDirectoryBar = (lat: number, lng: number): DirectoryBar | null => {
    if (!directoryBars.length) return null;
    let best: DirectoryBar | null = null;
    let bestD = Infinity;
    for (const b of directoryBars) {
      const dLat = b.lat - lat;
      const dLng = (b.lng - lng) * Math.cos((lat * Math.PI) / 180);
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  };
  const [spotDialogOpen, setSpotDialogOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);
  const [editingSpot, setEditingSpot] = useState<CustomSpot | null>(null);
  const [selectedDirectoryBar, setSelectedDirectoryBar] = useState<DirectoryBar | null>(null);

  const openAddDialog = (position: { x: number; y: number } | null) => {
    setEditingSpot(null);
    setPendingPosition(position ?? { x: 50, y: 50 });
    setSpotDialogOpen(true);
  };

  const openEditDialog = (spot: CustomSpot) => {
    setEditingSpot(spot);
    setPendingPosition(null);
    setSpotDialogOpen(true);
  };

  const handleSubmitSpot = (values: { name: string; note: string; icon: SpotIcon }) => {
    if (editingSpot) {
      updateSpot(editingSpot.id, values);
      setEditingSpot(null);
    } else {
      const position = pendingPosition ?? { x: 50, y: 50 };
      addSpot({ ...values, x: position.x, y: position.y });
      setPendingPosition(null);
    }
  };

  const handleMapLongPress = (latLng: { lat: number; lng: number }) => {
    // Convert lat/lng → x/y so addSpot stores both consistently
    const x = ((latLng.lng - MAP_CENTER.lng) / MAP_SPAN.lng + 0.5) * 100;
    const y = (0.5 - (latLng.lat - MAP_CENTER.lat) / MAP_SPAN.lat) * 100;
    openAddDialog({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const visibleBars = useMemo(() => {
    return directoryBarsAsBars.filter((bar) => {
      if (filter === "all") return true;
      if (filter === "cheap") return bar.beer <= 60;
      return bar.state === filter;
    });
  }, [filter, directoryBarsAsBars]);

  const activeBar =
    visibleBars.find((bar) => bar.id === selected) ?? visibleBars[0] ?? bars[0];

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-4 text-foreground sm:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-butter/60 bg-background shadow-panel animate-rise-in">
        <header className="bg-espresso px-5 pb-4 pt-3 text-secondary">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
            <span>9:41</span>
            <span>Thu 30 Apr · 16:21</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-1 text-xs font-medium text-flame"><Sparkles className="size-3" /> Live sun finder</p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-normal text-secondary">Sunny bars</h1>
              <p className="text-xs text-muted-foreground">Copenhagen · Indre By first</p>
            </div>
            <Button variant="glass" size="icon" aria-label="Search sunny bars"><Search className="size-4" /></Button>
          </div>
        </header>

        <div className="bg-espresso-soft px-5 pb-4">
          <div className="flex items-center gap-3 rounded-xl border border-butter/25 bg-cream/10 p-3 text-secondary backdrop-blur">
            <div className="grid size-11 place-items-center rounded-full bg-sun-gradient text-xl shadow-sun">
              {weather.loading ? "☀️" : iconForCloud(weather.currentCloudCover, weather.currentSunPct > 0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {weather.loading
                  ? "Loading weather…"
                  : weather.currentSunPct >= 70
                    ? "Clear enough for terraces"
                    : weather.currentSunPct >= 40
                      ? "Patchy sun, grab a spot"
                      : "Mostly cloudy right now"}
              </p>
              <p className="text-xs text-muted-foreground">
                {weather.loading
                  ? "Live conditions in Copenhagen"
                  : `${weather.currentCloudCover}% cloud cover · ${weather.currentTemp}°C`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-sun">
                {weather.loading ? "—" : `${weather.currentSunPct}%`}
              </p>
              <p className="text-[0.62rem] text-muted-foreground">possible sun</p>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {weather.loading && (
              <div className="text-xs text-muted-foreground">Loading hourly forecast…</div>
            )}
            {!weather.loading &&
              weather.hourly.map((hour) => (
                <div
                  key={hour.hour}
                  className={cn(
                    "min-w-14 rounded-xl border border-butter/20 bg-cream/8 px-3 py-2 text-center",
                    hour.hour === nowHour && "border-sun bg-sun/15",
                  )}
                >
                  <p className="text-[0.62rem] text-muted-foreground">{hour.time}:00</p>
                  <p className="text-base leading-5">{hour.icon}</p>
                  <p className="text-[0.68rem] font-semibold text-secondary">{hour.sunPct}%</p>
                </div>
              ))}
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto bg-espresso-soft px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Bar filters">
          {filters.map((item) => (
            <button key={item.key} onClick={() => setFilter(item.key)} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all", filter === item.key ? "border-primary bg-primary text-primary-foreground shadow-sun" : "border-butter/35 text-secondary hover:bg-cream/10")}>
              {item.label}
            </button>
          ))}
        </nav>

        <section
          className={cn("relative overflow-hidden bg-espresso transition-[height] duration-500", expanded ? "h-[430px]" : "h-[250px]")}
        >
          <MapView
            visibleBars={visibleBars}
            spots={spots}
            directoryBars={directoryBars}
            selectedBarId={activeBar.id}
            onSelectBar={(id) => { setSelected(id); setExpanded(false); }}
            onEditSpot={(spot) => openEditDialog(spot)}
            onSelectDirectoryBar={(bar) => setSelectedDirectoryBar(bar)}
            onLongPress={handleMapLongPress}
            onBoundsChanged={setMapBounds}
          />
          <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-md bg-espresso/85 px-3 py-1.5 text-xs font-medium text-secondary backdrop-blur">
            <LocateFixed className="size-3" /> Indre By, Copenhagen
          </div>
          <button className="absolute right-4 top-4 z-10 rounded-full bg-espresso/85 p-2 text-secondary backdrop-blur transition-transform hover:scale-105" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Collapse map" : "Expand map"}>
            {expanded ? <ChevronDown className="size-4" /> : <Navigation className="size-4" />}
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); openAddDialog(null); }}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute bottom-24 right-4 z-20 grid size-12 place-items-center rounded-full bg-sun-gradient text-espresso shadow-sun transition-transform hover:scale-105"
            aria-label="Add a custom sunny spot"
          >
            <Plus className="size-5" />
          </button>
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-butter/25 bg-espresso/90 p-3 text-secondary backdrop-blur-md">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeBar.name}</p>
              <p className="text-xs text-muted-foreground">{activeBar.dist} · {stateCopy[activeBar.state].label}</p>
            </div>
            <Button variant={favorites.includes(activeBar.id) ? "glass" : "sun"} size="sm" onClick={() => toggleFavorite(activeBar.id)}>
              <Heart className={cn("size-3", favorites.includes(activeBar.id) && "fill-current")} />
              {favorites.includes(activeBar.id) ? "Saved" : "Save"}
            </Button>
          </div>
        </section>

        <section className="bg-background px-4 py-3">
          <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-sun" /> Full sun</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-flame" /> Later</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-coral" /> Shade</span>
          </div>

          <div className="mt-3 px-1 text-xs text-muted-foreground">
            {visibleBars.length} bar{visibleBars.length === 1 ? "" : "s"} in view
          </div>
          <div className="mt-3 space-y-2">
            {visibleBars.map((bar) => (
              <BarCard
                key={bar.id}
                bar={bar}
                selected={selected === bar.id}
                isFavorite={favorites.includes(bar.id)}
                onSelect={() => {
                  setSelected(bar.id);
                  setExpanded(false);
                  const match = barsInView[bar.id] ?? findNearestDirectoryBar(bar.lat, bar.lng);
                  if (match) setSelectedDirectoryBar(match);
                }}
                onToggleFavorite={() => toggleFavorite(bar.id)}
              />
            ))}
          </div>

          {visibleBars.length === 0 && (
            <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center">
              <div>
                <X className="mx-auto mb-2 size-6 text-coral" />
                <p className="font-semibold">No sunny matches right now</p>
                <p className="text-sm text-muted-foreground">Try all bars or check the later sun window.</p>
              </div>
            </div>
          )}
        </section>

        <BottomNav favoritesCount={favorites.length + spots.length} />
      </section>
      <AddSpotDialog
        open={spotDialogOpen}
        onOpenChange={setSpotDialogOpen}
        position={pendingPosition}
        onSubmit={handleSubmitSpot}
        mode={editingSpot ? "edit" : "create"}
        initialSpot={editingSpot}
        onDelete={editingSpot ? () => removeSpot(editingSpot.id) : undefined}
      />
      <Sheet open={!!selectedDirectoryBar} onOpenChange={(open) => !open && setSelectedDirectoryBar(null)}>
        <SheetContent side="right" className="w-[340px] sm:w-[400px]">
          {selectedDirectoryBar && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedDirectoryBar.name}</SheetTitle>
                {selectedDirectoryBar.address && (
                  <SheetDescription>{selectedDirectoryBar.address}</SheetDescription>
                )}
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-sun" />
                  <span>
                    {selectedDirectoryBar.rating != null
                      ? `${selectedDirectoryBar.rating} / 5`
                      : "No rating"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Price: </span>
                  <span className="font-semibold">
                    {selectedDirectoryBar.price_level != null
                      ? "$".repeat(Math.max(1, selectedDirectoryBar.price_level))
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TreePine className={cn("size-4", selectedDirectoryBar.outdoor_seating ? "text-sun" : "text-muted-foreground")} />
                  <span>
                    {selectedDirectoryBar.outdoor_seating === true
                      ? "Outdoor seating available"
                      : selectedDirectoryBar.outdoor_seating === false
                        ? "No outdoor seating"
                        : "Outdoor seating unknown"}
                  </span>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sun timeline
                    </span>
                    {selectedDirectoryBar.timeline_date && (
                      <span className="text-[0.65rem] text-muted-foreground">
                        {selectedDirectoryBar.timeline_date}
                      </span>
                    )}
                  </div>
                  {selectedDirectoryBar.sun_timeline && selectedDirectoryBar.sun_timeline.length > 0 && (() => {
                    const tl = selectedDirectoryBar.sun_timeline;
                    const day = tl.filter((e) => e.sun_elev > 0);
                    const sunHours = day.filter((e) => e.sunlit).map((e) => e.hour);
                    const shadeHours = day.filter((e) => !e.sunlit).map((e) => e.hour);
                    const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;
                    const Row = ({ label, value }: { label: string; value: string }) => (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    );
                    return (
                      <div className="mb-3 space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                        <Row label="Sunrise" value={day.length ? fmt(day[0].hour) : "—"} />
                        <Row label="Sunset" value={day.length ? fmt(day[day.length - 1].hour) : "—"} />
                        <Row label="First sunlit hour" value={sunHours.length ? fmt(sunHours[0]) : "No direct sun"} />
                        <Row label="Last sunlit hour" value={sunHours.length ? fmt(sunHours[sunHours.length - 1]) : "No direct sun"} />
                        <Row label="First shade hour" value={shadeHours.length ? fmt(shadeHours[0]) : "Sunny all day"} />
                        <Row label="Last shade hour" value={shadeHours.length ? fmt(shadeHours[shadeHours.length - 1]) : "Sunny all day"} />
                        <Row label="Total sunlit hours" value={`${sunHours.length}h`} />
                      </div>
                    );
                  })()}
                  {selectedDirectoryBar.sun_timeline && selectedDirectoryBar.sun_timeline.length > 0 ? (
                    <div className="grid grid-cols-12 gap-1">
                      {selectedDirectoryBar.sun_timeline.map((entry) => {
                        const isDay = entry.sun_elev > 0;
                        const sunlit = isDay && entry.sunlit;
                        return (
                          <div
                            key={entry.hour}
                            className={cn(
                              "flex flex-col items-center gap-0.5 rounded-md border py-1 text-[0.6rem]",
                              !isDay
                                ? "border-border bg-muted/40 text-muted-foreground"
                                : sunlit
                                  ? "border-sun/40 bg-sun/15 text-sun"
                                  : "border-border bg-muted text-muted-foreground",
                            )}
                            title={`${entry.hour}:00 · ${!isDay ? "Night" : sunlit ? "Sun" : "Shade"}`}
                          >
                            <span className="text-sm leading-none">
                              {!isDay ? "🌙" : sunlit ? "☀️" : "🌑"}
                            </span>
                            <span>{entry.hour}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sun timeline not yet computed for this venue.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
};

export default Index;