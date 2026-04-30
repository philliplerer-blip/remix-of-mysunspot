import { useMemo, useState } from "react";
import { ChevronDown, LocateFixed, MapPin, Navigation, Plus, Search, Sparkles, Sun, Sunset, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SunState = "sun" | "soon" | "shade";
type Filter = "all" | "sun" | "soon" | "cheap";

const nowHour = 16.35;

const bars = [
  { id: 0, name: "Toldboden", area: "Harbour terrace", state: "sun" as SunState, beer: 65, dist: "0.4 km", start: 14.25, end: 20.5, x: 38, y: 34, vibe: "Waterfront spritz" },
  { id: 1, name: "Halvandet", area: "Refshaleøen", state: "sun" as SunState, beer: 75, dist: "1.2 km", start: 15.0, end: 21.25, x: 58, y: 54, vibe: "Golden hour deck" },
  { id: 2, name: "Palægade Bar", area: "Indre By", state: "soon" as SunState, beer: 72, dist: "0.8 km", start: 17.25, end: 19.75, x: 27, y: 63, vibe: "Street-side apéro" },
  { id: 3, name: "Nørreport Øl", area: "Market edge", state: "shade" as SunState, beer: 60, dist: "1.5 km", start: 12.25, end: 15.25, x: 67, y: 27, vibe: "Easy meetup" },
  { id: 4, name: "Christiania Pub", area: "Canal walk", state: "soon" as SunState, beer: 55, dist: "2.1 km", start: 17.75, end: 21.0, x: 44, y: 75, vibe: "Late sun tables" },
];

const hourly = [
  { time: "14", pct: 74, icon: "🌤️" },
  { time: "15", pct: 82, icon: "☀️" },
  { time: "16", pct: 88, icon: "☀️" },
  { time: "17", pct: 79, icon: "🌤️" },
  { time: "18", pct: 66, icon: "⛅" },
  { time: "19", pct: 58, icon: "⛅" },
  { time: "20", pct: 42, icon: "🌥️" },
];

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All bars" },
  { key: "sun", label: "Sun now" },
  { key: "soon", label: "Sun later" },
  { key: "cheap", label: "Cheap" },
];

const formatHour = (hour: number) => {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};

const stateCopy = {
  sun: { label: "Sunny now", tone: "bg-sun text-espresso", dot: "bg-sun", glow: "animate-sun-pulse" },
  soon: { label: "Sun later", tone: "bg-flame text-primary-foreground", dot: "bg-flame", glow: "" },
  shade: { label: "Mostly shade", tone: "bg-shade text-primary-foreground", dot: "bg-coral", glow: "" },
};

const Index = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [pointer, setPointer] = useState({ x: 56, y: 42 });

  const visibleBars = useMemo(() => {
    return bars.filter((bar) => {
      if (filter === "all") return true;
      if (filter === "cheap") return bar.beer <= 60;
      return bar.state === filter;
    });
  }, [filter]);

  const activeBar = bars.find((bar) => bar.id === selected) ?? bars[0];

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
          className={cn("relative overflow-hidden bg-map-gradient map-streets transition-[height] duration-500", expanded ? "h-[350px]" : "h-[205px]")}
          style={{ "--pointer-x": `${pointer.x}%`, "--pointer-y": `${pointer.y}%` } as React.CSSProperties}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPointer({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
          }}
        >
          <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-md bg-espresso/85 px-3 py-1.5 text-xs font-medium text-secondary backdrop-blur">
            <LocateFixed className="size-3" /> Indre By, Copenhagen
          </div>
          <button className="absolute right-4 top-4 z-10 rounded-full bg-espresso/85 p-2 text-secondary backdrop-blur transition-transform hover:scale-105" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Collapse map" : "Expand map"}>
            {expanded ? <ChevronDown className="size-4" /> : <Navigation className="size-4" />}
          </button>
          {bars.map((bar) => (
            <button key={bar.id} onClick={() => setSelected(bar.id)} className={cn("absolute z-10 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-espresso transition-all hover:scale-125", stateCopy[bar.state].dot, stateCopy[bar.state].glow, selected === bar.id && "scale-150 ring-4 ring-sun/30")} style={{ left: `${bar.x}%`, top: `${bar.y}%` }} aria-label={`Select ${bar.name}`}>
              <span className="size-1.5 rounded-full bg-primary-foreground" />
            </button>
          ))}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-butter/25 bg-espresso/90 p-3 text-secondary backdrop-blur-md">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeBar.name}</p>
              <p className="text-xs text-muted-foreground">{activeBar.dist} · {stateCopy[activeBar.state].label}</p>
            </div>
            <Button variant="sun" size="sm"><Plus className="size-3" /> Add spot</Button>
          </div>
        </section>

        <section className="bg-background px-4 py-3">
          <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-sun" /> Full sun</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-flame" /> Later</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-coral" /> Shade</span>
          </div>

          <div className="mt-3 space-y-2">
            {visibleBars.map((bar) => {
              const start = ((bar.start - 11) / 11) * 100;
              const width = ((bar.end - bar.start) / 11) * 100;
              const now = ((nowHour - 11) / 11) * 100;
              return (
                <article key={bar.id} onClick={() => setSelected(bar.id)} className={cn("cursor-pointer rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-sun", selected === bar.id ? "border-primary shadow-sun" : "border-border/80")}> 
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{bar.name}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">{bar.area} · {bar.vibe}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-1 text-[0.62rem] font-bold", stateCopy[bar.state].tone)}>{stateCopy[bar.state].label}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <SunriseIcon />
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("absolute top-0 h-full rounded-full", stateCopy[bar.state].dot)} style={{ left: `${start}%`, width: `${width}%`, opacity: bar.state === "shade" ? 0.45 : 1 }} />
                      <div className="absolute -top-1 h-4 w-0.5 rounded-full bg-espresso" style={{ left: `${now}%` }} />
                    </div>
                    <Sunset className="size-4 text-flame" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatHour(bar.start)}–{formatHour(bar.end)}</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3" /> {bar.dist} · {bar.beer} kr</span>
                  </div>
                </article>
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
      </section>
    </main>
  );
};

const SunriseIcon = () => <Sun className="size-4 text-sun" />;

export default Index;