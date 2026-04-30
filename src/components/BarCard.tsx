import { Heart, MapPin, Sun, Sunset } from "lucide-react";
import { Bar, formatHour, nowHour, stateCopy } from "@/lib/bars";
import { cn } from "@/lib/utils";

interface BarCardProps {
  bar: Bar;
  selected?: boolean;
  isFavorite: boolean;
  onSelect?: () => void;
  onToggleFavorite: () => void;
}

export const BarCard = ({ bar, selected, isFavorite, onSelect, onToggleFavorite }: BarCardProps) => {
  const start = ((bar.start - 11) / 11) * 100;
  const width = ((bar.end - bar.start) / 11) * 100;
  const now = ((nowHour - 11) / 11) * 100;
  return (
    <article
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-sun",
        selected ? "border-primary shadow-sun" : "border-border/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{bar.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{bar.area} · {bar.vibe}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-full px-2 py-1 text-[0.62rem] font-bold", stateCopy[bar.state].tone)}>{stateCopy[bar.state].label}</span>
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
        <span className="flex items-center gap-1"><MapPin className="size-3" /> {bar.dist} · {bar.beer} kr</span>
      </div>
    </article>
  );
};