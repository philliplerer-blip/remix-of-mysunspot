import { Heart, MapPin, Star, Sun, Sunset, TreePine } from "lucide-react";
import { Bar, formatHour, nowHour, stateCopy } from "@/lib/bars";
import type { DirectoryBar } from "@/hooks/use-bars-directory";
import type { WeatherHour } from "@/hooks/use-weather";
import { cn } from "@/lib/utils";

/**
 * Sun emoji that fills bottom-up based on a 0–100 score. We layer two copies:
 * a faded gray sun underneath, and a colored sun clipped to the bottom `score%`.
 */
const SunScoreIcon = ({ score }: { score: number }) => {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div
      className="relative grid size-9 place-items-center"
      role="img"
      aria-label={`Sun score ${pct} out of 100`}
      title={`Sun score: ${pct}/100`}
    >
      <span className="absolute inset-0 grid place-items-center text-2xl leading-none opacity-25 grayscale">
        ☀️
      </span>
      <span
        className="absolute inset-0 grid place-items-center text-2xl leading-none transition-[clip-path] duration-500"
        style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
      >
        ☀️
      </span>
    </div>
  );
};

interface BarCardProps {
  bar: Bar;
  selected?: boolean;
  isFavorite: boolean;
  onSelect?: () => void;
  onToggleFavorite: () => void;
  expanded?: boolean;
  details?: DirectoryBar | null;
  hourlyWeather?: WeatherHour[];
  nowHour?: number;
}

export const BarCard = ({ bar, selected, isFavorite, onSelect, onToggleFavorite, expanded, details, hourlyWeather, nowHour: nowHourProp }: BarCardProps) => {
  const start = ((bar.start - 11) / 11) * 100;
  const width = ((bar.end - bar.start) / 11) * 100;
  const now = ((nowHour - 11) / 11) * 100;

  const fmtCountdown = (totalMin: number) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };
  const mins = bar.minutesToChange;
  let countdown: { label: string; tone: string };
  if (bar.state === "sun") {
    countdown = mins != null
      ? { label: `Sun ends in ${fmtCountdown(mins)}`, tone: "bg-sun text-espresso" }
      : { label: "Sunny rest of day", tone: "bg-sun text-espresso" };
  } else if (bar.state === "soon") {
    countdown = mins != null
      ? { label: `Sun in ${fmtCountdown(mins)}`, tone: "bg-flame text-primary-foreground" }
      : { label: "Sun later", tone: "bg-flame text-primary-foreground" };
  } else {
    countdown = { label: "No sun left today", tone: "bg-shade text-primary-foreground" };
  }

  return (
    <article
      onClick={() => { navigator.vibrate?.(8); onSelect?.(); }}
      style={{ touchAction: "manipulation" }}
      className={cn(
        "snap-card cursor-pointer rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-sun active:scale-[0.99] active:opacity-95",
        selected ? "border-primary shadow-sun" : "border-border/80",
        expanded && "scale-[1.01] shadow-sun",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{bar.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{bar.area} · {bar.vibe}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {expanded && <SunScoreIcon score={bar.sunScore ?? 0} />}
          <span className={cn("rounded-full px-2 py-1 text-[0.62rem] font-bold", countdown.tone)}>{countdown.label}</span>
          <button
            onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }}
            className={cn(
              "grid size-8 place-items-center rounded-full border border-border bg-background transition-colors",
              isFavorite && "border-primary bg-primary text-primary-foreground",
            )}
            aria-label={isFavorite ? `Remove ${bar.name} from favorites` : `Save ${bar.name} to favorites`}
          >
            <Heart className={cn("size-4", isFavorite && "fill-current")} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Sun className="size-4 text-sun" />
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("absolute top-0 h-full rounded-full", stateCopy[bar.state].dot)}
            style={{ left: `${start}%`, width: `${width}%`, opacity: bar.state === "shade" ? 0.45 : 1 }}
          />
          <div className="absolute -top-1 h-4 w-0.5 rounded-full bg-espresso" style={{ left: `${now}%` }} />
        </div>
        <Sunset className="size-4 text-flame" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatHour(bar.start)}–{formatHour(bar.end)}</span>
        <span className="flex items-center gap-1">
          <MapPin className="size-3" /> {bar.dist}{expanded ? ` · ${bar.beer} kr` : ""}
        </span>
      </div>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          expanded ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          {details ? (
            <div className="space-y-3 border-t border-border/80 pt-3 text-sm animate-fade-in">
              {details.address && (
                <p className="text-xs text-muted-foreground">{details.address}</p>
              )}
              {hourlyWeather && hourlyWeather.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Hourly forecast
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {hourlyWeather.map((hour) => (
                      <div
                        key={hour.hour}
                        className={cn(
                          "min-w-12 shrink-0 rounded-lg border border-border/70 bg-muted/40 px-2 py-1.5 text-center",
                          hour.hour === nowHourProp && "border-sun bg-sun/15",
                        )}
                      >
                        <p className="text-[0.6rem] text-muted-foreground">{hour.time}:00</p>
                        <p className="text-sm leading-4">{hour.icon}</p>
                        <p className="text-[0.62rem] font-semibold">{hour.sunPct}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <span className="flex items-center gap-1">
                  <Star className="size-3.5 text-sun" />
                  {details.rating != null ? `${details.rating} / 5` : "No rating"}
                </span>
                <span>
                  <span className="text-muted-foreground">Price: </span>
                  <span className="font-semibold">
                    {details.price_level != null
                      ? "$".repeat(Math.max(1, details.price_level))
                      : "—"}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <TreePine className={cn("size-3.5", details.outdoor_seating ? "text-sun" : "text-muted-foreground")} />
                  {details.outdoor_seating === true
                    ? "Outdoor seating"
                    : details.outdoor_seating === false
                      ? "No outdoor seating"
                      : "Outdoor unknown"}
                </span>
              </div>
            </div>
          ) : expanded ? (
            <div className="border-t border-border/80 pt-3 text-xs text-muted-foreground animate-fade-in">
              Loading details…
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
};