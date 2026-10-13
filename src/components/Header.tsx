import { cn } from "../utils/cn";

type Props = {
  onHistory: () => void;
  onNewChat: () => void;
  onMemory: () => void;
  onAccount: () => void;
  onStudio?: () => void;
  onApps?: () => void;
  appsOpen?: boolean;
  historyOpen: boolean;
  studioOpen?: boolean;
  memoryCount: number;
  user: any;
};

const IC = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function IconBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => { try { navigator.vibrate?.(8); } catch {} onClick(); }}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-cream/80 transition-all hover:bg-white/[.07] hover:text-cream active:scale-90",
        active && "bg-gold/15 text-[#fff3d6]",
      )}
    >
      {children}
    </button>
  );
}

export function Header({ onHistory, onNewChat, onMemory, onAccount, onApps, appsOpen = false, historyOpen, memoryCount, user }: Props) {
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  return (
    <header className="dai-glass-top absolute inset-x-0 top-0 z-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-[56px] items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-0.5">
          <IconBtn label="Chats" onClick={onHistory} active={historyOpen}>
            <svg width="22" height="22" viewBox="0 0 24 24" {...IC}><path d="M4 7h16" /><path d="M4 12h10" /><path d="M4 17h16" /></svg>
          </IconBtn>
          <IconBtn label="New chat" onClick={onNewChat}>
            <svg width="21" height="21" viewBox="0 0 24 24" {...IC}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </IconBtn>
        </div>

        <h1 className="title-glow pointer-events-none absolute left-1/2 -translate-x-1/2 select-none font-display text-[30px] leading-none tracking-tight text-cream" aria-label="D'Ai">
          D’Ai
        </h1>

        <div className="flex items-center gap-0.5">
          <IconBtn label="Memory" onClick={onMemory}>
            <svg width="21" height="21" viewBox="0 0 24 24" {...IC}><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V4a3 3 0 0 0-3 0Z" /><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" /></svg>
            {memoryCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{memoryCount}</span>
            )}
          </IconBtn>
          <IconBtn label={user ? "Account" : "Sign in"} onClick={onAccount}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="User" className="h-7 w-7 rounded-full border border-gold/50 object-cover" />
            ) : (
              <svg width="21" height="21" viewBox="0 0 24 24" {...IC}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            )}
          </IconBtn>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" />
    </header>
  );
}
