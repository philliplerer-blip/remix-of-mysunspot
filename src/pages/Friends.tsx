import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { Copy, RefreshCw, X, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { UserBadge } from "@/components/UserBadge";
import { useAuth } from "@/hooks/use-auth";
import {
  friendsApi, setHandle, listFriendSummaries, getMyProfile,
  startPresence, endPresence, getMyActivePresence, getActiveFriendsPresence,
  type FriendSummary, type PresenceSession, type ProfileLite,
} from "@/lib/friends-api";

// Map raw error messages from edge functions / supabase into friendly toasts.
function explainScanError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("permission") || m.includes("notallowed")) return "Camera access denied. Enable it in your browser settings.";
  if (m.includes("notfound") || m.includes("no camera")) return "No camera found on this device.";
  if (m.includes("expired")) return "This invite QR has expired. Ask your friend to regenerate it.";
  if (m.includes("signature") || m.includes("malformed") || m.includes("not a valid")) return "That QR isn't a Sunny Bars invite.";
  if (m.includes("blocked")) return "You can't add this user.";
  if (m.includes("yourself")) return "That's your own QR — try someone else's.";
  if (m.includes("token/user mismatch")) return "QR data is inconsistent. Ask for a fresh one.";
  return raw || "Couldn't add friend.";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [qr, setQr] = useState<{ webLink: string; deepLink: string; expiresAt: number } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [summaries, setSummaries] = useState<FriendSummary[]>([]);
  const [searchHandle, setSearchHandle] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [myPresence, setMyPresence] = useState<PresenceSession | null>(null);
  const [activity, setActivity] = useState("");
  const [duration, setDuration] = useState(60);
  const [friendsPresence, setFriendsPresence] = useState<PresenceSession[]>([]);

  const refresh = async () => {
    const me = await getMyProfile();
    setProfile(me);
    setSummaries(await listFriendSummaries());
    setMyPresence(await getMyActivePresence());
    const fp = await getActiveFriendsPresence();
    setFriendsPresence(fp as PresenceSession[]);
  };

  useEffect(() => { if (user) refresh(); }, [user?.id]);

  // Tick once a second while a QR is on screen so the countdown updates.
  useEffect(() => {
    if (!qr) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [qr?.expiresAt]);

  // Handle deep-link /friends/add?u=&t=
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const u = params.get("u"); const t = params.get("t");
    if (u && t && window.location.pathname === "/friends/add") {
      friendsApi.requestByToken(u, t)
        .then(() => { toast.success("Friend request sent!"); refresh(); })
        .catch((e) => toast.error(e.message ?? "Invalid invite"))
        .finally(() => navigate("/friends", { replace: true }));
    }
  }, [user?.id]);

  const onSetHandle = async () => {
    try { await setHandle(handleInput); toast.success("Handle set"); refresh(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  };

  const onMintQr = async (silent = false) => {
    setQrLoading(true);
    try {
      const next = await friendsApi.mintQr();
      setQr(next);
      setNow(Date.now());
      if (!silent) toast.success("New invite QR ready");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to generate QR");
    } finally {
      setQrLoading(false);
    }
  };

  const onCopyLink = async () => {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.webLink);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy. Long-press the QR to share.");
    }
  };

  const onSendByHandle = async () => {
    try {
      const res = await friendsApi.requestByHandle(searchHandle);
      // Generic message — we never confirm whether the handle existed.
      toast.success(res.message); setSearchHandle(""); refresh();
    }
    catch (e: unknown) { toast.error((e as Error).message ?? "Failed"); }
  };

  const onRespond = async (id: string, action: "accept" | "decline" | "remove" | "block") => {
    try { await friendsApi.respond(id, action); toast.success("Done"); refresh(); }
    catch (e: unknown) { toast.error((e as Error).message ?? "Failed"); }
  };

  const stopScan = async () => {
    if (scanner) {
      try { await scanner.stop(); } catch { /* ignore */ }
      try { scanner.clear(); } catch { /* ignore */ }
      setScanner(null);
    }
    setScanning(false);
  };

  const startScan = async () => {
    setScanning(true);
    // Wait a tick so the #qr-reader div is mounted.
    setTimeout(async () => {
      let instance: Html5Qrcode | null = null;
      try {
        instance = new Html5Qrcode("qr-reader");
        setScanner(instance);
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          async (decoded) => {
            // Stop immediately to avoid duplicate scans.
            try { await instance!.stop(); instance!.clear(); } catch { /* ignore */ }
            setScanner(null);
            setScanning(false);
            try {
              const url = new URL(decoded);
              const u = url.searchParams.get("u");
              const t = url.searchParams.get("t");
              if (!u || !t) throw new Error("not a valid invite");
              if (u === user?.id) throw new Error("yourself");
              await friendsApi.requestByToken(u, t);
              toast.success("Friend request sent!");
              refresh();
            } catch (e: unknown) {
              toast.error(explainScanError((e as Error).message ?? ""));
            }
          },
          () => { /* per-frame decode failures are noisy; ignore */ },
        );
      } catch (e: unknown) {
        toast.error(explainScanError((e as Error).message ?? "Camera error"));
        setScanner(null);
        setScanning(false);
      }
    }, 0);
  };

  const onStartPresence = async () => {
    try { await startPresence({ activity, durationMinutes: duration }); setActivity(""); refresh(); toast.success("You're live"); }
    catch (e: unknown) { toast.error((e as Error).message ?? "Failed"); }
  };
  const onEndPresence = async () => {
    if (!myPresence) return;
    await endPresence(myPresence.id); refresh(); toast.success("Session ended");
  };

  const accepted = summaries.filter((s) => s.status === "accepted");
  const incoming = summaries.filter((s) => s.status === "pending" && s.requested_by !== user?.id);
  const outgoing = summaries.filter((s) => s.status === "pending" && s.requested_by === user?.id);
  const summaryById = useMemo(() => Object.fromEntries(summaries.map((s) => [s.user_id, s])), [summaries]);

  const presenceWithLabel = useMemo(
    () => friendsPresence.map((p) => ({ ...p, summary: summaryById[p.user_id] as FriendSummary | undefined })),
    [friendsPresence, summaryById],
  );

  if (!profile) return null;

  return (
    <main className="min-h-screen bg-app-gradient px-4 py-4 text-foreground sm:py-8">
      <section className="mx-auto flex h-[calc(100dvh-2rem)] sm:h-[calc(100dvh-4rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-butter/60 bg-background shadow-panel animate-rise-in">
        <header className="bg-espresso px-5 pb-5 pt-3 text-secondary">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
            <span>Your circle</span>
          </div>
          <div className="mt-4">
            <h1 className="font-display text-3xl font-semibold tracking-normal text-secondary">Friends</h1>
            <p className="text-xs text-muted-foreground">Share a sun spot with people you actually like.</p>
          </div>
        </header>

        <section className="flex-1 min-h-0 overflow-y-auto space-y-4 bg-background px-4 py-4">
        {!profile.handle && (
        <Card className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-1 font-semibold">Pick your @handle</h2>
          <p className="mb-3 text-xs text-muted-foreground">3–20 chars, lowercase, digits, underscore. Cannot be changed later.</p>
          <div className="flex gap-2">
            <Input value={handleInput} onChange={(e) => setHandleInput(e.target.value)} placeholder="anna_k" maxLength={20} />
            <Button onClick={onSetHandle}>Save</Button>
          </div>
        </Card>
      )}

      <Tabs defaultValue="friends" className="flex-1">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="presence">Live</TabsTrigger>
          <TabsTrigger value="add">Add</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4 py-3">
          {incoming.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incoming</h3>
              {incoming.map((s) => (
                <Card key={s.friendship_id} className="mb-2 flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                  <UserBadge handle={s.handle} displayName={s.display_name} statusEmoji={s.status_emoji} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onRespond(s.friendship_id, "accept")}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => onRespond(s.friendship_id, "decline")}>Decline</Button>
                  </div>
                </Card>
              ))}
            </section>
          )}
          {outgoing.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sent</h3>
              {outgoing.map((s) => (
                <Card key={s.friendship_id} className="mb-2 flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                  <UserBadge handle={s.handle} displayName={s.display_name} statusEmoji={s.status_emoji} />
                  <Button size="sm" variant="ghost" onClick={() => onRespond(s.friendship_id, "remove")}>Cancel</Button>
                </Card>
              ))}
            </section>
          )}
          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Friends ({accepted.length})</h3>
            {accepted.length === 0 && <p className="text-sm text-muted-foreground">No friends yet. Add some via QR or @handle.</p>}
            {accepted.map((s) => (
              <Card key={s.friendship_id} className="mb-2 flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                <button
                  type="button"
                  className="text-left flex-1"
                  onClick={() => s.handle && navigate(`/u/${s.handle}`)}
                >
                  <UserBadge handle={s.handle} displayName={s.display_name} statusEmoji={s.status_emoji} />
                </button>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onRespond(s.friendship_id, "remove")}>Remove</Button>
                  <Button size="sm" variant="ghost" onClick={() => onRespond(s.friendship_id, "block")}>Block</Button>
                </div>
              </Card>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="presence" className="space-y-4 py-3">
          {myPresence ? (
            <Card className="rounded-2xl border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">You're live:</div>
              <div className="text-lg font-semibold">{myPresence.activity}</div>
              <div className="text-xs text-muted-foreground">until {new Date(myPresence.expires_at).toLocaleTimeString()}</div>
              <Button onClick={onEndPresence} variant="ghost" className="mt-2">End now</Button>
            </Card>
          ) : (
            <Card className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <h3 className="font-semibold">Go live</h3>
              <Input placeholder="What are you up to?" value={activity} onChange={(e) => setActivity(e.target.value)} maxLength={80} />
              <div className="flex items-center gap-2">
                <label className="text-sm">Minutes:</label>
                <Input type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-24" />
              </div>
              <Button disabled={!activity.trim()} onClick={onStartPresence}>Start session</Button>
            </Card>
          )}

          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active friends</h3>
            {presenceWithLabel.length === 0 && <p className="text-sm text-muted-foreground">No friends are live right now.</p>}
            {presenceWithLabel.map((p) => (
              <Card key={p.id} className="mb-2 rounded-2xl border border-border bg-card p-3">
                <button
                  type="button"
                  onClick={() => p.summary?.handle && navigate(`/u/${p.summary.handle}`)}
                  className="font-semibold"
                >
                  <UserBadge handle={p.summary?.handle} displayName={p.summary?.display_name} statusEmoji={p.summary?.status_emoji} />
                </button>
                <div className="text-sm">{p.activity}</div>
                <div className="text-xs text-muted-foreground">until {new Date(p.expires_at).toLocaleTimeString()}</div>
              </Card>
            ))}
          </section>
        </TabsContent>

        <TabsContent value="add" className="space-y-4 py-3">
          <Card className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <h3 className="font-semibold">Find by @handle</h3>
            <div className="flex gap-2">
              <Input value={searchHandle} onChange={(e) => setSearchHandle(e.target.value)} placeholder="anna_k" />
              <Button onClick={onSendByHandle} disabled={!searchHandle.trim()}>Send</Button>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your invite QR</h3>
              {qr && (
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs font-medium " +
                    (qr.expiresAt - now <= 0
                      ? "bg-red-500/20 text-red-300"
                      : qr.expiresAt - now < 60 * 60_000
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-emerald-500/20 text-emerald-300")
                  }
                  aria-live="polite"
                >
                  {qr.expiresAt - now <= 0 ? "expired" : `expires in ${formatCountdown(qr.expiresAt - now)}`}
                </span>
              )}
            </div>
            {!profile.handle && <p className="text-xs text-muted-foreground">Set your handle first.</p>}
            {qr ? (
              <div className="flex flex-col items-center gap-3">
                <div className={"relative rounded bg-white p-3 " + (qr.expiresAt - now <= 0 ? "opacity-40" : "")}>
                  <QRCodeSVG value={qr.webLink} size={200} />
                  {qr.expiresAt - now <= 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-red-600">
                      Expired
                    </div>
                  )}
                </div>
                <p className="break-all text-center text-[11px] text-muted-foreground">{qr.webLink}</p>
                <div className="flex w-full gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={onCopyLink} disabled={qr.expiresAt - now <= 0}>
                    <Copy className="mr-1 size-4" /> Copy link
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => onMintQr(false)} disabled={qrLoading}>
                    {qrLoading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => onMintQr(true)} disabled={!profile.handle || qrLoading}>
                {qrLoading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <QrCode className="mr-1 size-4" />}
                Generate QR
              </Button>
            )}
          </Card>

          <Card className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Scan a friend's QR</h3>
              {scanning && (
                <Button variant="ghost" size="sm" onClick={stopScan}>
                  <X className="mr-1 size-4" /> Cancel
                </Button>
              )}
            </div>
            {scanning ? (
              <>
                <div id="qr-reader" className="overflow-hidden rounded bg-black/30" />
                <p className="text-xs text-muted-foreground">Point your camera at your friend's invite QR.</p>
              </>
            ) : (
              <Button onClick={startScan}>Open scanner</Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>
        </section>

        <BottomNav favoritesCount={0} />
      </section>
    </main>
  );
}