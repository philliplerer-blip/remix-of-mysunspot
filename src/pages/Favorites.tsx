import { Heart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarCard } from "@/components/BarCard";
import { BottomNav } from "@/components/BottomNav";
import { useFavorites } from "@/hooks/use-favorites";
import { bars } from "@/lib/bars";

const Favorites = () => {
  const { favorites, toggleFavorite } = useFavorites();
  const savedBars = bars.filter((bar) => favorites.includes(bar.id));

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-4 text-foreground sm:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-butter/60 bg-background shadow-panel animate-rise-in">
        <header className="bg-espresso px-5 pb-5 pt-3 text-secondary">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
            <span>9:41</span>
            <span>Thu 30 Apr · 16:21</span>
          </div>
          <div className="mt-4">
            <p className="flex items-center gap-1 text-xs font-medium text-flame"><Sparkles className="size-3" /> Your sunny shortlist</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-normal text-secondary">Favorites</h1>
            <p className="text-xs text-muted-foreground">{savedBars.length} bookmarked {savedBars.length === 1 ? "spot" : "spots"}</p>
          </div>
        </header>

        <section className="flex-1 bg-background px-4 py-4">
          {savedBars.length === 0 ? (
            <div className="grid min-h-[60vh] place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center">
              <div className="space-y-3">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-sun-gradient text-2xl shadow-sun">
                  <Heart className="size-6 text-espresso" />
                </div>
                <p className="font-semibold">No favorites yet</p>
                <p className="text-sm text-muted-foreground">Tap the heart on any bar to bookmark it here.</p>
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
            </div>
          )}
        </section>

        <BottomNav favoritesCount={favorites.length} />
      </section>
    </main>
  );
};

export default Favorites;