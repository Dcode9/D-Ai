import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Plate } from "./frames/Plate";
import { getSession } from "../lib/supabase";

export type AppId = "tunes" | "quest";

type AppDef = { id: AppId; name: string; tag: string; blurb: string; url: string; glyph: ReactNode };

const APPS: AppDef[] = [
  {
    id: "tunes",
    name: "D’Tunes",
    tag: "Music",
    blurb: "Search and play songs, build queues and playlists.",
    url: "https://tunes.d-verse.in/",
    glyph: (
      <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 33V13l18-4v20" />
        <circle cx="14" cy="34" r="5" />
        <circle cx="32" cy="30" r="5" />
      </svg>
    ),
  },
  {
    id: "quest",
    name: "D’Quest",
    tag: "Quizzes",
    blurb: "Play or generate quizzes, host live rooms with a PIN.",
    url: "https://d-quest.vercel.app/",
    glyph: (
      <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 6l5 11 12 1.5-9 8 2.6 12L24 32.5 13.4 38.5 16 26.5l-9-8L19 17z" />
      </svg>
    ),
  },
];

export function openAppEvent(app: AppId, query?: string, play?: boolean) {
  window.dispatchEvent(new CustomEvent("dai:open-app", { detail: { app, query, play } }));
}

type Props = { open: boolean; onClose: () => void; initialApp?: { app: AppId; query?: string; play?: boolean; n: number } | null };

export function AppsDrawer({ open, onClose, initialApp }: Props) {
  const [active, setActive] = useState<AppDef | null>(null);
  const [src, setSrc] = useState("");
  const [loaded, setLoaded] = useState(false);

  const launch = (app: AppDef, query?: string, play?: boolean) => {
    setLoaded(false);
    setActive(app);
    setSrc(query ? `${app.url}?q=${encodeURIComponent(query)}${play && app.id === "tunes" ? "&play=1" : ""}` : app.url);
  };

  useEffect(() => {
    if (!initialApp) return;
    const def = APPS.find((a) => a.id === initialApp.app);
    if (def) launch(def, initialApp.query, initialApp.play);
  }, [initialApp?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div
        className={cn("absolute inset-0 z-30 bg-black/40 transition-opacity duration-300", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 z-40 h-full pb-[env(safe-area-inset-bottom)] drop-shadow-[0_0_40px_rgba(0,0,0,.7)] transition-[transform,width] duration-500 ease-[cubic-bezier(.2,.7,.2,1)]",
          active ? "w-[min(920px,98vw)]" : "w-[min(400px,92vw)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <Plate variant="text" className="flex h-full flex-col">
          <div className="relative flex items-center justify-between gap-3 px-8 pb-3 pt-8 sm:px-9 sm:pt-9">
            <div className="flex items-center gap-3">
              {active && (
                <button type="button" onClick={() => setActive(null)} aria-label="Back to apps" className="cursor-pointer text-gold/70 transition-colors hover:text-cream">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
              )}
              <h2 className="font-display text-[30px] text-cream">{active ? active.name : "Apps"}</h2>
            </div>
            <div className="flex items-center gap-3">
              {active && (
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm border border-gold/30 px-2.5 py-1 font-body text-[12px] text-gold/80 transition-colors hover:border-gold/60 hover:text-cream"
                >
                  Open in tab ↗
                </a>
              )}
              <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-gold/70 transition-colors hover:text-cream">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          {!active ? (
            <div className="relative flex-1 space-y-3 overflow-y-auto px-8 pb-9 sm:px-9 scroll-gold">
              <p className="pb-1 font-body text-[14px] font-light text-muted">
                Your D’Verse apps, right here. Ask D’Ai to play a song or start a quiz and it opens here.
              </p>
              {APPS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => launch(a)}
                  className="group flex w-full cursor-pointer items-center gap-4 rounded-md border border-gold/30 bg-black/30 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:bg-gold/10 active:scale-[0.985]"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gradient-to-br from-[#6b3fa0]/50 to-[#c9a04a]/30 text-gold-2 transition-transform group-hover:rotate-6">
                    {a.glyph}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="font-display text-[22px] text-cream">{a.name}</span>
                      <span className="font-body text-[11px] uppercase tracking-[0.18em] text-gold/70">{a.tag}</span>
                    </span>
                    <span className="mt-0.5 block font-body text-[13.5px] font-light text-muted">{a.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="relative mx-5 mb-8 flex-1 overflow-hidden rounded-md border border-gold/30 bg-black/50 sm:mx-7">
              {!loaded && <div className="absolute inset-0 flex items-center justify-center font-display italic text-gold/70">Opening {active.name}…</div>}
              <iframe
                key={src}
                src={src}
                title={active.name}
                className="h-full w-full border-0"
                allow="autoplay; clipboard-write; fullscreen; microphone"
                onLoad={(e) => {
                  setLoaded(true);
                  // Shared login: hand the signed-in session to the app (exact origin only).
                  try {
                    const origin = new URL(src, window.location.href).origin;
                    if (origin === window.location.origin) return;
                    const win = e.currentTarget.contentWindow;
                    void getSession().then((sess) => {
                      if (sess && win) win.postMessage({ type: "dverse-auth:handoff", access_token: sess.access_token, refresh_token: sess.refresh_token }, origin);
                    });
                  } catch { /* ignore */ }
                }}
              />
            </div>
          )}
        </Plate>
      </aside>
    </>
  );
}
