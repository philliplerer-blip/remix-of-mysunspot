import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface VenueOption { id: string; name: string; address: string | null; }

export const ClaimVenueForm = ({ onSubmitted }: { onSubmitted?: () => void }) => {
  const { user } = useAuth();
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [search, setSearch] = useState("");
  const [venueId, setVenueId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bars_directory")
        .select("id, name, address")
        .order("name").limit(500);
      setVenues((data ?? []) as VenueOption[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return venues.slice(0, 50);
    return venues.filter((v) => v.name.toLowerCase().includes(q) || (v.address ?? "").toLowerCase().includes(q)).slice(0, 50);
  }, [search, venues]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !venueId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("venue_claims").insert({
        user_id: user.id, venue_id: venueId, business_name: businessName,
        contact_email: contactEmail, phone: phone || null,
      });
      if (error) throw error;
      toast.success("Claim submitted! An admin will review it shortly.");
      onSubmitted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-butter/60 bg-background p-4 shadow-panel">
      <h2 className="font-display text-lg font-semibold">Claim your venue</h2>
      <div>
        <Label>Search venues</Label>
        <Input placeholder="e.g. Lunden" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="max-h-48 overflow-auto rounded-lg border border-butter/40">
        {filtered.map((v) => (
          <button type="button" key={v.id}
            className={`flex w-full items-start justify-between gap-2 border-b border-butter/20 p-2 text-left text-sm last:border-0 ${venueId === v.id ? "bg-amber-100" : ""}`}
            onClick={() => setVenueId(v.id)}>
            <span>
              <span className="font-semibold">{v.name}</span>
              <span className="block text-xs text-muted-foreground">{v.address}</span>
            </span>
            {venueId === v.id && <span className="text-xs">✓</span>}
          </button>
        ))}
        {filtered.length === 0 && <p className="p-2 text-xs text-muted-foreground">No matches.</p>}
      </div>
      <div><Label>Business name</Label>
        <Input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
      <div><Label>Contact email</Label>
        <Input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
      <div><Label>Phone (optional)</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <Button type="submit" variant="sun" className="w-full" disabled={busy || !venueId || !businessName || !contactEmail}>
        Submit claim
      </Button>
    </form>
  );
};