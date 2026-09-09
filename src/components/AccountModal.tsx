import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getUser,
  signInWithGoogle,
  signOut,
  onAuthStateChange,
  signInWithDverseId,
  signUpWithDverseId,
  getDverseProfile,
  type DverseProfile,
} from "../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
  savedChatsCount: number;
  memoryFactsCount: number;
};

export function AccountModal({ open, onClose, savedChatsCount, memoryFactsCount }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DverseProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mode: "signin" | "signup"
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Sign In fields
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Create D'Verse ID fields
  const [regHandle, setRegHandle] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const refreshUserData = async () => {
    const u = await getUser();
    setUser(u);
    if (u) {
      const p = await getDverseProfile(u.id);
      setProfile(p);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    refreshUserData();
    const sub = onAuthStateChange((u) => {
      setUser(u);
      if (u) {
        getDverseProfile(u.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  if (!open) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign in failed";
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  const handleDverseSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await signInWithDverseId({
        identifier: loginIdentifier,
        password: loginPassword,
      });
      setUser(res.user);
      if (res.user) {
        const p = await getDverseProfile(res.user.id);
        setProfile(p);
      }
      setLoginPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDverseSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await signUpWithDverseId({
        dverseId: regHandle,
        displayName: regDisplayName,
        email: regEmail,
        password: regPassword,
      });
      setUser(res.user);
      if (res.user) {
        const p = await getDverseProfile(res.user.id);
        setProfile(p);
      }
      setRegPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Account creation failed";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signOut();
      setUser(null);
      setProfile(null);
    } catch (err: unknown) {
      console.error("Sign out failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const rawHandle = profile?.dverse_id || user?.user_metadata?.dverse_id;
  const dverseHandle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`) : null;
  const fullName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (dverseHandle ? dverseHandle : user?.email?.split("@")[0] || "User");
  const email = profile?.email || user?.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dark glass backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Ornate Modal Frame */}
      <div className="relative my-auto w-full max-w-[460px] overflow-hidden rounded-xl border border-gold/40 bg-[#0c0910]/95 p-6 shadow-[0_16px_60px_rgba(0,0,0,0.9)] sm:p-7 z-10">
        {/* Double-rail heraldic borders */}
        <div className="pointer-events-none absolute inset-2 rounded-lg border border-gold/25" />
        <div className="pointer-events-none absolute inset-[11px] rounded border border-gold/10" />

        {/* Header */}
        <div className="relative mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl text-gold">✦</span>
            <h2 className="font-display text-[22px] tracking-[0.06em] text-cream">
              {user ? "Sovereign Account" : "Access D'Verse Realm"}
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

        {/* Error Notice */}
        {errorMsg && (
          <div className="relative mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-[13px] text-rose-200 leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="text-rose-400">⚠</span>
              <div className="flex-1">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="relative space-y-4">
          {user ? (
            /* Signed In State */
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border border-gold/30 bg-black/40 p-3.5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-13 w-13 rounded-full border border-gold/50 object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-gradient-to-br from-gold/30 to-gold/10 font-display text-xl text-gold shadow-md">
                    {fullName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="truncate font-display text-[17px] font-medium text-cream">{fullName}</h3>
                    {dverseHandle && (
                      <span className="rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[11px] font-mono font-medium tracking-wide text-gold">
                        {dverseHandle}
                      </span>
                    )}
                  </div>
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
            /* Signed Out State */
            <div className="space-y-4">
              {/* Option 1: Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gold/40 bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 px-5 py-3 font-display text-[13px] uppercase tracking-[0.14em] text-cream shadow-md transition-all hover:border-gold hover:from-gold/30 hover:to-gold/30 disabled:opacity-50"
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

              {/* Heraldic Divider */}
              <div className="relative flex items-center justify-center my-3">
                <div className="grow border-t border-gold/20" />
                <span className="mx-3 text-[11px] font-display uppercase tracking-[0.2em] text-gold/70">
                  ✦ or D'Verse ID ✦
                </span>
                <div className="grow border-t border-gold/20" />
              </div>

              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-gold/20 bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setErrorMsg(null);
                  }}
                  className={`rounded-md py-1.5 text-[12px] font-display uppercase tracking-wider transition-all cursor-pointer ${
                    authMode === "signin"
                      ? "bg-gold/20 text-cream font-medium shadow-sm border border-gold/30"
                      : "text-muted hover:text-cream"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setErrorMsg(null);
                  }}
                  className={`rounded-md py-1.5 text-[12px] font-display uppercase tracking-wider transition-all cursor-pointer ${
                    authMode === "signup"
                      ? "bg-gold/20 text-cream font-medium shadow-sm border border-gold/30"
                      : "text-muted hover:text-cream"
                  }`}
                >
                  Create ID
                </button>
              </div>

              {authMode === "signin" ? (
                /* D'Verse ID Sign In Form */
                <form onSubmit={handleDverseSignIn} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-display uppercase tracking-wider text-gold/80 mb-1">
                      D'Verse ID or Email
                    </label>
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="@username or name@domain.com"
                      required
                      className="w-full rounded-lg border border-gold/30 bg-black/50 px-3 py-2 text-[14px] text-cream placeholder-gold/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 font-body"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-display uppercase tracking-wider text-gold/80 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-lg border border-gold/30 bg-black/50 px-3 py-2 text-[14px] text-cream placeholder-gold/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 font-body"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full cursor-pointer rounded-lg border border-gold/50 bg-gold/20 px-4 py-2.5 font-display text-[13px] uppercase tracking-[0.14em] text-cream shadow-md transition-all hover:bg-gold/30 hover:border-gold disabled:opacity-50"
                  >
                    {loading ? "Authenticating…" : "Sign In with D'Verse ID"}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setErrorMsg(null);
                      }}
                      className="text-[12px] text-gold/70 hover:text-gold transition-colors underline cursor-pointer"
                    >
                      Don't have a D'Verse ID? Create one
                    </button>
                  </div>
                </form>
              ) : (
                /* Create D'Verse ID Form */
                <form onSubmit={handleDverseSignUp} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-display uppercase tracking-wider text-gold/80 mb-1">
                      D'Verse ID Handle
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-[14px] font-mono text-gold/60 select-none">@</span>
                      <input
                        type="text"
                        value={regHandle}
                        onChange={(e) => setRegHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        placeholder="yourname"
                        maxLength={24}
                        required
                        className="w-full rounded-lg border border-gold/30 bg-black/50 pl-7 pr-3 py-2 text-[14px] text-cream placeholder-gold/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 font-mono tracking-wide"
                      />
                    </div>
                    <span className="block text-[10px] text-gold/50 mt-1">
                      Unique handle across D'Verse (letters, numbers, underscore)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-display uppercase tracking-wider text-gold/80 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder="e.g. Dhairya Shah"
                      className="w-full rounded-lg border border-gold/30 bg-black/50 px-3 py-2 text-[14px] text-cream placeholder-gold/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 font-body"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-display uppercase tracking-wider text-gold/80 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@domain.com"
                      required
                      className="w-full rounded-lg border border-gold/30 bg-black/50 px-3 py-2 text-[14px] text-cream placeholder-gold/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 font-body"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-display uppercase tracking-wider text-gold/80 mb-1">
                      Password (min 6 characters)
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      className="w-full rounded-lg border border-gold/30 bg-black/50 px-3 py-2 text-[14px] text-cream placeholder-gold/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 font-body"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full cursor-pointer rounded-lg border border-gold/50 bg-gold/20 px-4 py-2.5 font-display text-[13px] uppercase tracking-[0.14em] text-cream shadow-md transition-all hover:bg-gold/30 hover:border-gold disabled:opacity-50"
                  >
                    {loading ? "Creating Sovereign Account…" : "Create D'Verse ID"}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setErrorMsg(null);
                      }}
                      className="text-[12px] text-gold/70 hover:text-gold transition-colors underline cursor-pointer"
                    >
                      Already have a D'Verse ID? Sign In
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-lg border border-gold/15 bg-black/30 p-2.5 text-center font-body text-[11px] text-muted">
                Guest Mode: Conversations and memory are stored locally on this device.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
