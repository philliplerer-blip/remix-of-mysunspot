import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVenueOwner } from "@/hooks/use-venue-owner";

interface Claim {
  id: string; user_id: string; venue_id: string; business_name: string;
  contact_email: string; phone: string | null; status: string; submitted_at: string;
  bars_directory: { name: string; address: string | null };
}

const AdminClaims = () => {
  const { isAdmin, loading } = useVenueOwner();
  const [claims, setClaims] = useState<Claim[]>([]);

  const refresh = async () => {
    const { data } = await supabase.from("venue_claims")
      .select("id, user_id, venue_id, business_name, contact_email, phone, status, submitted_at, bars_directory!inner(name, address)")
      .order("submitted_at", { ascending: false });
    setClaims((data ?? []) as unknown as Claim[]);
  };
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const act = async (claim_id: string, action: "approve" | "reject") => {
    const { error } = await supabase.functions.invoke("approve-venue-claim", { body: { claim_id, action } });
    if (error) toast.error(error.message); else { toast.success(`Claim ${action}d`); refresh(); }
  };

  if (loading) return <main className="min-h-screen bg-app-gradient p-6">Loading…</main>;
  if (!isAdmin) return <main className="min-h-screen bg-app-gradient p-6">Admins only.</main>;

  return (
    <main className="min-h-screen bg-app-gradient p-6 text-foreground">
      <div className="mx-auto max-w-3xl space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Back</Link>
        <h1 className="font-display text-2xl font-semibold">Venue claims</h1>
        {claims.length === 0 && <p className="text-sm text-muted-foreground">No claims yet.</p>}
        <ul className="space-y-2">
          {claims.map((c) => (
            <li key={c.id} className="rounded-2xl border border-butter/60 bg-background p-4 shadow-panel">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.business_name} → {c.bars_directory.name}</p>
                  <p className="text-xs text-muted-foreground">{c.bars_directory.address}</p>
                  <p className="text-xs">{c.contact_email}{c.phone ? ` · ${c.phone}` : ""}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide">{c.status}</p>
                </div>
                {c.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="sun" onClick={() => act(c.id, "approve")}><Check className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => act(c.id, "reject")}><X className="size-4" /></Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};

export default AdminClaims;