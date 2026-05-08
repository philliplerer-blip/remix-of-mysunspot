import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";

const Auth = () => {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome! You're signed up.");
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

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(`${provider === "google" ? "Google" : "Apple"} sign-in failed`);
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-8 text-foreground">
      <section className="mx-auto w-full max-w-[430px] rounded-[2rem] border border-butter/60 bg-background p-6 shadow-panel">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-full bg-sun-gradient text-espresso shadow-sun">
            <Sun className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Sunny Spots</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" variant="sun" className="w-full" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2">
          <Button type="button" variant="outline" className="w-full" onClick={() => oauth("google")} disabled={busy}>
            Continue with Google
          </Button>
          <Button
            type="button"
            className="w-full bg-black text-white hover:bg-black/90"
            onClick={() => oauth("apple")}
            disabled={busy}
          >
            <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16.365 1.43c0 1.14-.41 2.23-1.23 3.04-.83.83-2.18 1.46-3.27 1.37-.13-1.1.42-2.27 1.18-3.02.85-.87 2.27-1.5 3.32-1.39zM20.5 17.42c-.6 1.4-.9 2.03-1.68 3.27-1.08 1.71-2.6 3.84-4.49 3.85-1.68.02-2.11-1.1-4.4-1.08-2.28.02-2.76 1.1-4.45 1.08-1.88-.02-3.32-1.95-4.4-3.66-3.02-4.78-3.34-10.4-1.47-13.39C.95 5.4 3.06 4.13 5.05 4.13c2.02 0 3.3 1.11 4.97 1.11 1.62 0 2.61-1.11 4.95-1.11 1.77 0 3.65.97 4.99 2.65-4.39 2.4-3.68 8.67.54 10.64z"/>
            </svg>
            Continue with Apple
          </Button>
        </div>

        <button
          type="button"
          className="mt-5 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
        <button
          type="button"
          className="mt-2 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => nav("/venue/auth")}
        >
          Are you a restaurant or bar? Venue partner login →
        </button>
      </section>
    </main>
  );
};

export default Auth;
