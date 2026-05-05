import { useEffect, useMemo, useRef, useState } from "react";
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
import { Filter, bars, filters, stateCopy, isEffectivelySunny, findNextSunChange, computeSunScore, type Bar, type SunState, type SunTimelineEntry } from "@/lib/bars";
import type { SunScoreEntry } from "@/hooks/use-bars-directory";
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
  // Quantize to ~3 decimals (~100m) so small GPS jitter doesn't refetch weather constantly
  const weatherLat = Math.round(geo.lat * 1000) / 1000;
  const weatherLng = Math.round(geo.lng * 1000) / 1000;
  const weather = useWeather(weatherLat, weatherLng);
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
    const nowDate = new Date();
    const currentHour = nowDate.getHours();
    const nowHourFloat = currentHour + nowDate.getMinutes() / 60;
    const weatherByHour = new Map<number, number>(
      weather.hourly.map((h) => [h.hour, h.sunPct]),
    );
    return barsInView.map((b, idx) => {
      const tl = (b.sun_timeline ?? []) as SunTimelineEntry[];
      const stl = (b.sun_score_timeline ?? []) as SunScoreEntry[];
      // Effective-sun hours combine 3D shadow geometry with hourly cloud cover.
      const effHours = tl
        .filter((e) => isEffectivelySunny(e, weatherByHour.get(e.hour)))
        .map((e) => e.hour);
      const start = effHours.length ? effHours[0] : 12;
      const end = effHours.length ? effHours[effHours.length - 1] + 1 : 18;

      const currentEntry = tl.find((e) => e.hour === currentHour);
      const sunNow = isEffectivelySunny(currentEntry, weatherByHour.get(currentHour));

      let state: SunState;
      if (sunNow) state = "sun";
      else if (effHours.some((h) => h > currentHour)) state = "soon";
      else state = "shade";

      // Time until the next flip, derived from the same shadow + weather model.
      const change = findNextSunChange(tl, weatherByHour, nowHourFloat);
      const minutesToChange = change
        ? Math.max(0, Math.round((change.atHour - nowHourFloat) * 60))
        : null;

      const dKm = haversineKm(MAP_CENTER.lat, MAP_CENTER.lng, b.lat, b.lng);
      const dist = dKm < 1 ? `${Math.round(dKm * 1000)} m` : `${dKm.toFixed(1)} km`;
      const priceKr = b.price_level != null ? 50 + b.price_level * 15 : 65;
      const scoreEntry = stl.find((e) => e.hour === currentHour);
      const sunScore = computeSunScore(scoreEntry, weatherByHour.get(currentHour));
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
        minutesToChange,
        sunScore,
      };
    });
  }, [barsInView, weather.hourly, now]);

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
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLElement | null>(null);
  const lastScrollTop = useRef(0);

  const handleListScroll = (e: React.UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop;
    const prev = lastScrollTop.current;
    if (top > prev + 4 && top > 16 && expanded) {
      setExpanded(false);
    } else if (top <= 4 && !expanded) {
      setExpanded(true);
    }
    lastScrollTop.current = top;
  };

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
    <main className="h-app overflow-hidden bg-app-gradient px-0 pl-safe pr-safe text-foreground sm:px-4 sm:py-8">
      <section className="mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden border-butter/60 bg-background shadow-panel animate-rise-in sm:h-[calc(100dvh-4rem)] sm:rounded-[2rem] sm:border">
        <header className="bg-espresso px-4 pb-3 text-secondary pt-safe xs:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[0.68rem] font-medium text-flame"><Sparkles className="size-3" /> Live sun finder</p>
              <h1 className="mt-0.5 truncate font-display text-2xl font-semibold tracking-normal text-secondary xs:text-[1.65rem]">Sunny bars</h1>
              <p className="truncate text-[0.68rem] text-muted-foreground">
                {geo.source === "gps" ? "Your location" : "Copenhagen"} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Button variant="glass" size="icon" aria-label="Search sunny bars" className="shrink-0"><Search className="size-4" /></Button>
          </div>
        </header>

        <div className="bg-espresso-soft px-4 pb-3 xs:px-5">
          <div className="flex items-center gap-3 rounded-xl border border-butter/25 bg-cream/10 px-3 py-2 text-secondary backdrop-blur">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-sun-gradient text-lg shadow-sun">
              {weather.loading ? "☀️" : iconForCloud(weather.currentCloudCover, weather.currentSunPct > 0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {weather.loading
                  ? "Loading weather…"
                  : weather.currentSunPct >= 70
                    ? "Clear enough for terraces"
                    : weather.currentSunPct >= 40
                      ? "Patchy sun, grab a spot"
                      : "Mostly cloudy right now"}
              </p>
              <p className="truncate text-[0.68rem] text-muted-foreground">
                {weather.loading ? "Live conditions" : `${weather.currentCloudCover}% cloud · ${weather.currentTemp}°C`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold leading-none text-sun">
                {weather.loading ? "—" : `${weather.currentSunPct}%`}
              </p>
              <p className="text-[0.6rem] text-muted-foreground">sun</p>
            </div>
          </div>

        </div>

        <nav className="flex gap-2 overflow-x-auto bg-espresso-soft px-4 pb-3 xs:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Bar filters">
          {filters.map((item) => (
            <button key={item.key} onClick={() => setFilter(item.key)} style={{ touchAction: "manipulation" }} className={cn("min-h-9 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]", filter === item.key ? "border-primary bg-primary text-primary-foreground shadow-sun" : "border-butter/35 text-secondary hover:bg-cream/10")}>
              {item.label}
            </button>
          ))}
        </nav>

        <section
          className={cn("relative shrink-0 overflow-hidden bg-espresso transition-[height] duration-500", expanded ? "h-map-expanded" : "h-map-collapsed")}
        >
          <MapView
            visibleBars={visibleBars}
            spots={spots}
            directoryBars={directoryBars}
            selectedBarId={activeBar.id}
            onSelectBar={(id) => { setSelected(id); setExpanded(false); }}
            onEditSpot={(spot) => openEditDialog(spot)}
            onSelectDirectoryBar={(bar) => {
              setSelectedDirectoryBar(bar);
              const idx = barsInView.findIndex((b) => b.id === bar.id);
              if (idx >= 0) {
                setSelected(idx);
                setExpanded(false);
                requestAnimationFrame(() => {
                  cardRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
                });
              }
            }}
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
          <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-butter/25 bg-espresso/90 p-3 text-secondary backdrop-blur-md">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeBar.name}</p>
              <p className="text-xs text-secondary/70">{activeBar.dist} · {stateCopy[activeBar.state].label}</p>
            </div>
            <button
              onClick={() => toggleFavorite(activeBar.id)}
              aria-label={favorites.includes(activeBar.id) ? "Remove from favorites" : "Save to favorites"}
              className="grid size-8 shrink-0 place-items-center rounded-full text-secondary/80 transition-transform hover:scale-110"
            >
              <Heart className={cn("size-4", favorites.includes(activeBar.id) && "fill-secondary text-secondary")} />
            </button>
          </div>
        </section>

        <section
          ref={listRef}
          onScroll={handleListScroll}
          className="momentum-scroll flex-1 min-h-0 overflow-y-auto bg-background px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-sun" /> Full sun</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-flame" /> Later</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-coral" /> Shade</span>
          </div>

          <div className="mt-3 px-1 text-xs text-muted-foreground">
            {visibleBars.length} bar{visibleBars.length === 1 ? "" : "s"} in view
          </div>
          <div className="mt-3 space-y-2">
            {visibleBars.map((bar) => {
              const isExpanded = selected === bar.id;
              const match = isExpanded
                ? (barsInView[bar.id] ?? findNearestDirectoryBar(bar.lat, bar.lng))
                : null;
              return (
                <div
                  key={bar.id}
                  ref={(el) => { cardRefs.current[bar.id] = el; }}
                  className={cn(!isExpanded && "cv-auto")}
                >
                  <BarCard
                    bar={bar}
                    selected={isExpanded}
                    expanded={isExpanded}
                    details={match}
                    hourlyWeather={weather.hourly}
                    nowHour={nowHour}
                    isFavorite={favorites.includes(bar.id)}
                    onSelect={() => {
                      if (selected === bar.id) {
                        setSelected(-1);
                        setSelectedDirectoryBar(null);
                        return;
                      }
                      setSelected(bar.id);
                      setExpanded(false);
                      const m = barsInView[bar.id] ?? findNearestDirectoryBar(bar.lat, bar.lng);
                      if (m) setSelectedDirectoryBar(m);
                      requestAnimationFrame(() => {
                        cardRefs.current[bar.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      });
                    }}
                    onToggleFavorite={() => toggleFavorite(bar.id)}
                  />
                </div>
              );
            })}
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
    </main>
  );
};

export default Index;