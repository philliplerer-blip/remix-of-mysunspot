import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVenueOwner } from "@/hooks/use-venue-owner";

const SendBlast = () => {
  const nav = useNavigate();
  const { venues, loading } = useVenueOwner();
  const [venueId, setVenueId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobilepay">("card");
  const [busy, setBusy] = useState(false);

  if (loading) return <main className="min-h-screen bg-app-gradient p-6">Loading…</main>;
  if (venues.length === 0) {
    return <main className="min-h-screen bg-app-gradient p-6">You don't own any venues yet. <Link to="/venue" className="underline">Go back</Link>.</main>;
  }
  const effectiveVenue = venueId || venues[0].venue_id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-blast-checkout", {
        body: { venue_id: effectiveVenue, title, body, link_url: linkUrl || null, payment_method: paymentMethod },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; checkout_url?: string | null; test_mode?: boolean; message?: string; error?: string };
      if (result?.error) throw new Error(result.error);
      if (result?.checkout_url) {
        // TODO(payments): redirect to live Stripe Checkout when wired
        window.location.href = result.checkout_url;
        return;
      }
      toast.success(result?.message ?? "Blast sent!");
      nav("/venue");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-app-gradient p-6 text-foreground">
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/venue" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <h1 className="font-display text-2xl font-semibold">Send a blast</h1>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Test mode:</strong> No real charges. Payment is auto-confirmed so you can test the full flow.
          Stripe & MobilePay live keys will be added later.
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-butter/60 bg-background p-4 shadow-panel">
          {venues.length > 1 && (
            <div>
              <Label>Venue</Label>
              <select className="w-full rounded-md border p-2" value={effectiveVenue} onChange={(e) => setVenueId(e.target.value)}>
                {venues.map((v) => <option key={v.venue_id} value={v.venue_id}>{v.name}</option>)}
              </select>
            </div>
          )}
          <div><Label>Title</Label>
            <Input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sun's out — happy hour ☀️" /></div>
          <div><Label>Message</Label>
            <Textarea required maxLength={240} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Half-price spritz on the terrace until 7pm" rows={3} />
            <p className="mt-1 text-xs text-muted-foreground">{body.length}/240</p></div>
          <div><Label>Link (optional)</Label>
            <Input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" /></div>

          <div>
            <Label>Payment method</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentMethod("card")}
                className={`rounded-xl border p-3 text-sm ${paymentMethod === "card" ? "border-amber-500 bg-amber-50" : "border-butter/60"}`}>
                💳 Card (Stripe)
              </button>
              <button type="button" onClick={() => setPaymentMethod("mobilepay")}
                className={`rounded-xl border p-3 text-sm ${paymentMethod === "mobilepay" ? "border-amber-500 bg-amber-50" : "border-butter/60"}`}>
                📱 MobilePay
              </button>
            </div>
          </div>

          <Button type="submit" variant="sun" className="w-full" disabled={busy}>
            <Send className="mr-2 size-4" /> {busy ? "Processing…" : "Send for 49 DKK"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Limit: 2 blasts/day, 7/week. Recipients: app users seen within 1 km in the last 7 days.
          </p>
        </form>
      </div>
    </main>
  );
};

export default SendBlast;