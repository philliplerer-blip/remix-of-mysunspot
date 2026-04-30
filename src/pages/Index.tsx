import { useMemo, useRef, useState } from "react";
import { ChevronDown, Heart, LocateFixed, Navigation, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarCard } from "@/components/BarCard";
import { BottomNav } from "@/components/BottomNav";
import { AddSpotDialog } from "@/components/AddSpotDialog";
import { useFavorites } from "@/hooks/use-favorites";
import { useCustomSpots } from "@/hooks/use-custom-spots";
import { Filter, bars, filters, stateCopy } from "@/lib/bars";
import { spotEmoji } from "@/lib/spots";
import { cn } from "@/lib/utils";

const hourly = [
  { time: "14", pct: 74, icon: "🌤️" },
  { time: "15", pct: 82, icon: "☀️" },
  { time: "16", pct: 88, icon: "☀️" },
  { time: "17", pct: 79, icon: "🌤️" },
  { time: "18", pct: 66, icon: "⛅" },
  { time: "19", pct: 58, icon: "⛅" },
  { time: "20", pct: 42, icon: "🌥️" },
];

const Index = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [pointer, setPointer] = useState({ x: 56, y: 42 });
  const { favorites, toggleFavorite } = useFavorites();
  const { spots, addSpot } = useCustomSpots();
  const [spotDialogOpen, setSpotDialogOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressMoved = useRef(false);

  const openAddDialog = (position: { x: number; y: number } | null) => {
    setPendingPosition(position ?? { x: 50, y: 50 });
    setSpotDialogOpen(true);
  };

  const handleSubmitSpot = (values: { name: string; note: string; icon: import("@/lib/spots").SpotIcon }) => {
    const position = pendingPosition ?? { x: 50, y: 50 };
    addSpot({ ...values, x: position.x, y: position.y });
    setPendingPosition(null);
  };

  const visibleBars = useMemo(() => {
    return bars.filter((bar) => {
      if (filter === "all") return true;
      if (filter === "cheap") return bar.beer <= 60;
      return bar.state === filter;
    });
  }, [filter]);

  const activeBar = visibleBars.find((bar) => bar.id === selected) ?? visibleBars[0] ?? bars[0];

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
            <div className="grid size-11 place-items-center rounded-full bg-sun-gradient text-xl shadow-sun">☀️</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Clear enough for terraces</p>
              <p className="text-xs text-muted-foreground">18% cloud cover · southwest sun path</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-sun">82%</p>
              <p className="text-[0.62rem] text-muted-foreground">possible sun</p>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {hourly.map((hour) => (
              <div key={hour.time} className={cn("min-w-14 rounded-xl border border-butter/20 bg-cream/8 px-3 py-2 text-center", hour.time === "16" && "border-sun bg-sun/15")}>
                <p className="text-[0.62rem] text-muted-foreground">{hour.time}:00</p>
                <p className="text-base leading-5">{hour.icon}</p>
                <p className="text-[0.68rem] font-semibold text-secondary">{hour.pct}%</p>
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
          className={cn("relative overflow-hidden bg-map-gradient map-streets transition-[height] duration-500", expanded ? "h-[430px]" : "h-[250px]")}
          style={{ "--pointer-x": `${pointer.x}%`, "--pointer-y": `${pointer.y}%` } as React.CSSProperties}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPointer({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
            pressMoved.current = true;
          }}
          onPointerDown={(event) => {
            pressMoved.current = false;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            if (pressTimer.current) window.clearTimeout(pressTimer.current);
            pressTimer.current = window.setTimeout(() => {
              if (!pressMoved.current) openAddDialog({ x, y });
            }, 550);
          }}
          onPointerUp={() => {
            if (pressTimer.current) {
              window.clearTimeout(pressTimer.current);
              pressTimer.current = null;
            }
          }}
          onPointerLeave={() => {
            if (pressTimer.current) {
              window.clearTimeout(pressTimer.current);
              pressTimer.current = null;
            }
          }}
        >
          <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-md bg-espresso/85 px-3 py-1.5 text-xs font-medium text-secondary backdrop-blur">
            <LocateFixed className="size-3" /> Indre By, Copenhagen
          </div>
          <button className="absolute right-4 top-4 z-10 rounded-full bg-espresso/85 p-2 text-secondary backdrop-blur transition-transform hover:scale-105" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Collapse map" : "Expand map"}>
            {expanded ? <ChevronDown className="size-4" /> : <Navigation className="size-4" />}
          </button>
          {visibleBars.map((bar) => (
            <button key={bar.id} onClick={() => { setSelected(bar.id); setExpanded(false); }} className={cn("absolute z-10 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-espresso transition-all hover:scale-125", stateCopy[bar.state].dot, stateCopy[bar.state].glow, selected === bar.id && "scale-150 ring-4 ring-sun/30")} style={{ left: `${bar.x}%`, top: `${bar.y}%` }} aria-label={`Select ${bar.name}`}>
              <span className="size-1.5 rounded-full bg-primary-foreground" />
            </button>
          ))}
          {spots.map((spot) => (
            <div
              key={spot.id}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              <div className="grid size-7 place-items-center rounded-full border-2 border-espresso bg-cream text-base shadow-panel" aria-label={spot.name}>
                <span aria-hidden>{spotEmoji(spot.icon)}</span>
              </div>
            </div>
          ))}
          <button
            onClick={(event) => { event.stopPropagation(); openAddDialog(pointer); }}
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

          <div className="mt-3 space-y-2">
            {visibleBars.map((bar) => (
              <BarCard
                key={bar.id}
                bar={bar}
                selected={selected === bar.id}
                isFavorite={favorites.includes(bar.id)}
                onSelect={() => { setSelected(bar.id); setExpanded(false); }}
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

        <BottomNav favoritesCount={favorites.length} />
      </section>
      <AddSpotDialog
        open={spotDialogOpen}
        onOpenChange={setSpotDialogOpen}
        position={pendingPosition}
        onSubmit={handleSubmitSpot}
      />
    </main>
  );
};

export default Index;