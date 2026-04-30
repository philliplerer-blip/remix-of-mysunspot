import { MapPin, Trash2 } from "lucide-react";
import { spotEmoji, type CustomSpot } from "@/lib/spots";

interface SpotCardProps {
  spot: CustomSpot;
  onRemove: () => void;
}

export const SpotCard = ({ spot, onRemove }: SpotCardProps) => (
  <article className="rounded-2xl border border-border/80 bg-card p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-sun-gradient text-lg shadow-sun">
          <span aria-hidden>{spotEmoji(spot.icon)}</span>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{spot.name}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> Custom spot
          </p>
          {spot.note && (
            <p className="mt-1 text-xs text-foreground/80 line-clamp-2">{spot.note}</p>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-coral transition-colors hover:bg-muted"
        aria-label={`Remove ${spot.name}`}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  </article>
);