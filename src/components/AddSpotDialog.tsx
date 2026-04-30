import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { spotIcons, type SpotIcon } from "@/lib/spots";
import { cn } from "@/lib/utils";

const spotSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Give your spot a name" })
    .max(60, { message: "Keep the name under 60 characters" }),
  note: z
    .string()
    .trim()
    .max(200, { message: "Notes are limited to 200 characters" }),
  icon: z.enum(["bench", "hill", "park", "pier", "stairs", "tree", "other"]),
});

export interface AddSpotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: { x: number; y: number } | null;
  onSubmit: (values: { name: string; note: string; icon: SpotIcon }) => void;
}

export const AddSpotDialog = ({ open, onOpenChange, position, onSubmit }: AddSpotDialogProps) => {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [icon, setIcon] = useState<SpotIcon>("bench");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setNote("");
      setIcon("bench");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = spotSchema.safeParse({ name, note, icon });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check the fields");
      return;
    }
    onSubmit(result.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-butter/40 bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Bookmark a sunny spot</DialogTitle>
          <DialogDescription>
            Save a bench, hill, pier, or any place that catches the sun{position ? " — pinned where you tapped." : "."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="spot-name">Name</Label>
            <Input
              id="spot-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Bench by the canal"
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spot-note">Note (optional)</Label>
            <Textarea
              id="spot-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Best 4–6pm, faces southwest"
              maxLength={200}
              rows={3}
            />
            <p className="text-right text-[0.65rem] text-muted-foreground">{note.length}/200</p>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {spotIcons.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  onClick={() => setIcon(option.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    icon === option.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  <span aria-hidden>{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs font-medium text-coral">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="sun">Save spot</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};