import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Send, Users, BarChart3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useVenueOwner, type OwnedVenue } from "@/hooks/use-venue-owner";
import { ClaimVenueForm } from "./ClaimVenueForm";

interface ClaimRow {
  id: string;
  venue_id: string;
  business_name: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
}

const VenueDashboard = () => {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { venues, loading, isVenueOwner } = useVenueOwner();
  const [selected, setSelected] = useState<OwnedVenue | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [trend, setTrend] = useState<Array<{ hour: string; users: number }>>([]);
  const [blasts, setBlasts] = useState<Array<{ id: string; title: string; sent_at: string | null; recipients_count: number; status: string; created_at: string }>>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);

  useEffect(() => { if (venues[0] && !selected) setSelected(venues[0]); }, [venues, selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      const [c, t, b] = await Promise.all([
        supabase.rpc("venue_nearby_count", { _venue_id: selected.venue_id }),
        supabase.rpc("venue_hourly_trend", { _venue_id: selected.venue_id }),
        supabase.from("blasts").select("id, title, sent_at, recipients_count, status, created_at")
          .eq("venue_id", selected.venue_id).order("created_at", { ascending: false }).limit(10),
      ]);
      if (cancelled) return;
      setCount((c.data as number) ?? 0);
      setTrend(((t.data ?? []) as Array<{ hour: string; users: number }>));
      setBlasts((b.data ?? []) as typeof blasts);
    })();
    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    if (isVenueOwner) return;
    (async () => {
      const { data } = await supabase.from("venue_claims")
        .select("id, venue_id, business_name, status, reject_reason")
        .order("submitted_at", { ascending: false });
      setClaims((data ?? []) as ClaimRow[]);
    })();
  }, [isVenueOwner]);

  if (loading) return <main className="min-h-screen bg-app-gradient p-6 text-foreground">Loading…</main>;

  if (!isVenueOwner) {
    const pending = claims.find((c) => c.status === "pending");
    const rejected = claims.find((c) => c.status === "rejected");
    return (
      <main className="min-h-screen bg-app-gradient p-6 text-foreground">
        <div className="mx-auto max-w-2xl space-y-4">
          <header className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-semibold">Venue Partner</h1>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => nav("/venue/auth"))}>
              <LogOut className="mr-1 size-4" /> Sign out
            </Button>
          </header>
          {pending && (
            <div className="rounded-2xl border border-butter/60 bg-background p-4 shadow-panel">
              <p className="font-semibold">Claim pending review</p>
              <p className="text-sm text-muted-foreground">"{pending.business_name}" — an admin will approve shortly.</p>
            </div>
          )}
          {rejected && (
            <div className="rounded-2xl border border-destructive/40 bg-background p-4 shadow-panel">
              <p className="font-semibold text-destructive">Claim rejected</p>
              <p className="text-sm text-muted-foreground">{rejected.reject_reason ?? "Please contact support."}</p>
            </div>
          )}
          <ClaimVenueForm onSubmitted={() => window.location.reload()} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-app-gradient p-6 text-foreground">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">{selected?.name ?? "Venue"}</h1>
            <p className="text-xs text-muted-foreground">{selected?.address}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => nav("/venue/auth"))}>
            <LogOut className="mr-1 size-4" /> Sign out
          </Button>
        </header>

        {venues.length > 1 && (
          <select
            className="w-full rounded-xl border border-butter/60 bg-background p-2"
            value={selected?.venue_id ?? ""}
            onChange={(e) => setSelected(venues.find((v) => v.venue_id === e.target.value) ?? null)}
          >
            {venues.map((v) => <option key={v.venue_id} value={v.venue_id}>{v.name}</option>)}
          </select>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-butter/60 bg-background p-4 shadow-panel">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" /> Users near you (last 7 days, 1 km)
            </div>
            <p className="mt-2 font-display text-4xl font-bold">{count ?? "…"}</p>
          </div>
          <Link to="/venue/send" className="rounded-2xl border border-butter/60 bg-sun-gradient p-4 text-espresso shadow-sun transition active:scale-[0.98]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Send className="size-4" /> Send a blast
            </div>
            <p className="mt-2 text-xs">Reach nearby app users instantly · 49 DKK</p>
          </Link>
        </div>

        <div className="rounded-2xl border border-butter/60 bg-background p-4 shadow-panel">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="size-4" /> Hourly trend (last 24h)
          </div>
          <div className="flex h-24 items-end gap-1">
            {trend.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
            {trend.map((t) => {
              const max = Math.max(1, ...trend.map((x) => x.users));
              const h = (t.users / max) * 100;
              return <div key={t.hour} className="flex-1 rounded-t bg-amber-400/80" style={{ height: `${h}%`, minHeight: "2px" }} title={`${new Date(t.hour).getHours()}:00 — ${t.users} users`} />;
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-butter/60 bg-background p-4 shadow-panel">
          <p className="mb-2 text-sm font-semibold">Recent blasts</p>
          {blasts.length === 0 && <p className="text-xs text-muted-foreground">No blasts yet.</p>}
          <ul className="space-y-2">
            {blasts.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-lg border border-butter/40 p-2 text-sm">
                <div>
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()} · {b.status}</p>
                </div>
                <span className="text-xs">{b.recipients_count} recipients</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
};

export default VenueDashboard;