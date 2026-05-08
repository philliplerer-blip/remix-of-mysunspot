import { Link } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { useNews } from "@/hooks/use-news";

const News = () => {
  const { items, markRead, loading } = useNews();
  return (
    <main className="min-h-screen bg-app-gradient p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Back</Link>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Bell className="size-5" /> News</h1>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">No news yet. Restaurants near you will post here.</p>}
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} onClick={() => !n.read_at && markRead(n.id)}
              className={`cursor-pointer rounded-2xl border p-4 shadow-panel ${n.read_at ? "border-butter/40 bg-background/70" : "border-amber-400 bg-background"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{n.title}</p>
                <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              {n.link_url && <a href={n.link_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">Open link</a>}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};

export default News;