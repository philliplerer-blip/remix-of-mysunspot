import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const VenueAuth = () => {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) nav("/venue", { replace: true }); }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/venue`,
            data: { display_name: businessName, account_type: "venue" },
          },
        });
        if (error) throw error;
        toast.success("Account created. Now claim your venue.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-8 text-foreground">
      <section className="mx-auto w-full max-w-[430px] rounded-[2rem] border border-butter/60 bg-background p-6 shadow-panel">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-full bg-sun-gradient text-espresso shadow-sun">
            <Store className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Venue Partners</h1>
            <p className="text-xs text-muted-foreground">For restaurants & bars</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <Label htmlFor="biz">Business name</Label>
              <Input id="biz" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
          )}
          <div><Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" variant="sun" className="w-full" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create venue account"}
          </Button>
        </form>
        <button type="button"
          className="mt-5 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}>
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
        <button type="button"
          className="mt-3 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => nav("/auth")}>
          I'm a regular user, not a venue
        </button>
      </section>
    </main>
  );
};

export default VenueAuth;