import { Heart, MapPin, Star, Sun, Sunset, TreePine } from "lucide-react";
import { Bar, formatHour, nowHour, stateCopy } from "@/lib/bars";
import type { DirectoryBar } from "@/hooks/use-bars-directory";
import { cn } from "@/lib/utils";

interface BarCardProps {
  bar: Bar;
  selected?: boolean;
  isFavorite: boolean;
  onSelect?: () => void;
  onToggleFavorite: () => void;
  expanded?: boolean;
  details?: DirectoryBar | null;
}

export const BarCard = ({ bar, selected, isFavorite, onSelect, onToggleFavorite, expanded, details }: BarCardProps) => {
  const start = ((bar.start - 11) / 11) * 100;
  const width = ((bar.end - bar.start) / 11) * 100;
  const now = ((nowHour - 11) / 11) * 100;

  const nowDate = new Date();
  const realNow = nowDate.getHours() + nowDate.getMinutes() / 60;
  const fmtCountdown = (hoursAhead: number) => {
    const totalMin = Math.max(0, Math.round(hoursAhead * 60));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  };
  let countdown: { label: string; tone: string } | null = null;
  if (bar.state === "sun") {
    countdown = {
      label: `Sun ends in ${fmtCountdown(bar.end - realNow)}`,
      tone: "bg-sun text-espresso",
    };
  } else if (bar.state === "soon") {
    countdown = {
      label: `Sun in ${fmtCountdown(bar.start - realNow)}`,
      tone: "bg-flame text-primary-foreground",
    };
  } else {
    countdown = {
      label: "No sun left today",
      tone: "bg-shade text-primary-foreground",
    };
  }

  return (
    <article
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-sun",
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
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sun timeline
                  </span>
                  {details.timeline_date && (
                    <span className="text-[0.62rem] text-muted-foreground">{details.timeline_date}</span>
                  )}
                </div>
                {details.sun_timeline && details.sun_timeline.length > 0 ? (
                  <div className="grid grid-cols-12 gap-1">
                    {details.sun_timeline.map((entry) => {
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