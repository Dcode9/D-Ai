import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getUser, signInWithGoogle, signOut, onAuthStateChange } from "../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
  savedChatsCount: number;
  memoryFactsCount: number;
};

export function AccountModal({ open, onClose, savedChatsCount, memoryFactsCount }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUser().then(setUser);
    const sub = onAuthStateChange((u) => {
      setUser(u);
    });
    return () => sub.unsubscribe();
  }, []);

  if (!open) return null;

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Sign in failed:", err);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      setUser(null);
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const email = user?.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark glass backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Ornate Modal Frame */}
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-xl border border-gold/40 bg-[#0c0910]/95 p-6 shadow-[0_12px_48px_rgba(0,0,0,0.85)] sm:p-7">
        {/* Double-rail heraldic borders */}
        <div className="pointer-events-none absolute inset-2 rounded-lg border border-gold/25" />
        <div className="pointer-events-none absolute inset-[11px] rounded border border-gold/10" />

        {/* Header */}
        <div className="relative mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl text-gold">✦</span>
            <h2 className="font-display text-[22px] tracking-[0.06em] text-cream">
              {user ? "Sovereign Account" : "Sign In to D'Ai"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-1 text-gold/60 transition-colors hover:text-cream"
            aria-label="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="relative space-y-5">
          {user ? (
            /* Signed In State */
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border border-gold/30 bg-black/40 p-3.5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-12 w-12 rounded-full border border-gold/50 object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 bg-gold/15 font-display text-lg text-gold">
                    {fullName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-[17px] font-medium text-cream">{fullName}</h3>
                  <p className="truncate font-body text-[13px] text-muted">{email}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gold-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Supabase Cloud Sync Active
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 font-body">
                <div className="rounded-lg border border-gold/20 bg-white/[0.02] p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-muted">Saved Chats</div>
                  <div className="font-display text-xl text-cream">{savedChatsCount}</div>
                </div>
                <div className="rounded-lg border border-gold/20 bg-white/[0.02] p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-muted">Remembered Facts</div>
                  <div className="font-display text-xl text-cream">{memoryFactsCount}</div>
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full cursor-pointer rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 font-display text-[13px] uppercase tracking-[0.14em] text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
              >
                {loading ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          ) : (
            /* Guest / Signed Out State */
            <div className="space-y-4">
              <p className="font-body text-[14px] leading-relaxed text-[#d4c8af]">
                Sign in with Google to synchronize your conversations, saved intelligence, and personal memory across all your devices via Supabase cloud storage.
              </p>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gold/40 bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 px-5 py-3 font-display text-[14px] uppercase tracking-[0.14em] text-cream shadow-md transition-all hover:border-gold hover:from-gold/30 hover:to-gold/30 disabled:opacity-50"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.25 21.37 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.26C.46 8.16 0 9.99 0 12s.46 3.84 1.26 5.43l4.02-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.26 6.57l4.02 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>{loading ? "Connecting…" : "Continue with Google"}</span>
              </button>

              <div className="rounded-lg border border-gold/15 bg-black/30 p-3 text-center font-body text-[12px] text-muted">
                Guest Mode: Conversations and memory are stored locally on this device.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
