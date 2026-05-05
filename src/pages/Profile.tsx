import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Loader2, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { BottomNav } from "@/components/BottomNav";
import { UserBadge } from "@/components/UserBadge";
import { useAuth } from "@/hooks/use-auth";
import {
  friendsApi, getMyProfile, getProfileByHandle,
  type FullProfile,
} from "@/lib/friends-api";
import { ALLOWED_STATUS_EMOJI, STATUS_EMOJI_LABELS } from "@/lib/profile-emoji";

export default function Profile() {
  const { user } = useAuth();
  const params = useParams<{ handle?: string }>();
  const navigate = useNavigate();
  const isOwn = !params.handle;

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // editable buffers (own profile only)
  const [displayName, setDisplayName] = useState("");
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [qr, setQr] = useState<{ webLink: string; expiresAt: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true); setNotFound(false);
    (async () => {
      try {
        if (isOwn) {
          const me = await getMyProfile() as FullProfile | null;
          if (cancelled) return;
          if (me) {
            setProfile(me);
            setDisplayName(me.display_name ?? "");
            setStatusEmoji(me.status_emoji ?? null);
            setStatusText(me.status_text ?? "");
            setIsPrivate(me.visibility === "private");
          }
        } else {
          const other = await getProfileByHandle(params.handle!);
          if (cancelled) return;
          if (!other) setNotFound(true);
          else setProfile(other);
        }
      } catch (e: unknown) {
        if (!cancelled) toast.error((e as Error).message ?? "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, params.handle, isOwn]);

  const onSave = async () => {
    setSaving(true);
    try {
      const { profile: next } = await friendsApi.updateMyProfile({
        display_name: displayName,
        status_emoji: statusEmoji,
        status_text: statusText || null,
        visibility: isPrivate ? "private" : "friends_only",
      });
      setProfile(next);
      toast.success("Profile saved");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onMintQr = async () => {
    try {
      const next = await friendsApi.mintQr();
      setQr({ webLink: next.webLink, expiresAt: next.expiresAt });
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "QR failed");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-app items-center justify-center bg-espresso text-secondary">
        <Loader2 className="size-6 animate-spin" />
      </main>
    );
  }

  // Default-deny: identical UI for "no such handle" and "not allowed to see".
  if (!isOwn && (notFound || !profile)) {
    return (
      <main className="flex min-h-app flex-col bg-espresso text-secondary">
        <header className="px-4 pt-safe pt-4 pb-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Profile not found</h1>
            <p className="mt-2 text-sm text-secondary/60">No user with that handle, or you don't have permission to view it.</p>
          </div>
        </div>
        <BottomNav favoritesCount={0} />
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="flex min-h-app flex-col bg-espresso text-secondary pb-4">
      <header className="px-4 pt-safe pt-4 pb-2">
        <h1 className="text-2xl font-bold">{isOwn ? "Your profile" : "Profile"}</h1>
      </header>

      <div className="px-4 space-y-4">
        <Card className="border-butter/30 bg-espresso-light p-4">
          <UserBadge
            handle={profile.handle}
            displayName={profile.display_name}
            statusEmoji={profile.status_emoji}
            className="text-lg font-semibold"
          />
          {profile.status_text && (
            // Plain text only; React escapes by default. We never use dangerouslySetInnerHTML here.
            <p className="mt-1 text-sm text-secondary/80">{profile.status_text}</p>
          )}
          {profile.status_updated_at && (
            <p className="mt-1 text-xs text-secondary/50">
              Updated {new Date(profile.status_updated_at).toLocaleString()}
            </p>
          )}
          {isOwn && profile.visibility === "private" && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              <EyeOff className="size-3" /> Hidden from friends
            </div>
          )}
        </Card>

        {isOwn && (
          <>
            <Card className="border-butter/30 bg-espresso-light p-4 space-y-3">
              <h2 className="font-semibold">Edit</h2>
              <div>
                <label className="text-xs text-secondary/60">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
              </div>
              <div>
                <label className="text-xs text-secondary/60">Status</label>
                <div className="mt-1 grid grid-cols-5 gap-2">
                  {ALLOWED_STATUS_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-label={STATUS_EMOJI_LABELS[e]}
                      onClick={() => setStatusEmoji(statusEmoji === e ? null : e)}
                      className={
                        "flex flex-col items-center rounded-lg border p-2 text-2xl transition-all " +
                        (statusEmoji === e
                          ? "border-butter bg-butter/20 scale-105"
                          : "border-butter/20 hover:border-butter/50")
                      }
                    >
                      <span aria-hidden>{e}</span>
                      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-secondary/60">
                        {STATUS_EMOJI_LABELS[e]}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-secondary/50">10 options. The leaf represents hops.</p>
              </div>
              <div>
                <label className="text-xs text-secondary/60">Status text ({statusText.length}/60)</label>
                <Input value={statusText} onChange={(e) => setStatusText(e.target.value.slice(0, 60))} maxLength={60} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-butter/20 p-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {isPrivate ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {isPrivate ? "Hidden" : "Visible to friends"}
                  </div>
                  <p className="text-xs text-secondary/60">
                    {isPrivate ? "Only you can see your profile." : "Mutual friends can view your profile."}
                  </p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
              <Button onClick={onSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Save
              </Button>
            </Card>

            {profile.handle && (
              <Card className="border-butter/30 bg-espresso-light p-4 space-y-3">
                <h2 className="font-semibold">Your invite QR</h2>
                <p className="text-xs text-secondary/60">@{profile.handle}</p>
                {qr ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded bg-white p-3"><QRCodeSVG value={qr.webLink} size={180} /></div>
                    <p className="text-[11px] break-all text-center text-secondary/50">{qr.webLink}</p>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={onMintQr}>Generate QR</Button>
                )}
              </Card>
            )}
          </>
        )}
      </div>

      <BottomNav favoritesCount={0} />
    </main>
  );
}