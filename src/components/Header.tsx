import { useSize } from "../hooks/useSize";
import { HeaderArch } from "./frames/HeaderArch";
import { cn } from "../utils/cn";

type Props = {
  onHistory: () => void;
  onNewChat: () => void;
  onMemory: () => void;
  onAccount: () => void;
  historyOpen: boolean;
  memoryCount: number;
  user: any;
};

function SmallButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-[38px] cursor-pointer items-center gap-2 px-3.5 font-body text-[16px] text-cream/90 outline-none transition-colors",
        "hover:text-[#fff3d6] focus-visible:text-[#fff3d6]",
      )}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-[3px] border transition-colors",
          active ? "border-gold-2/80" : "border-gold/55 group-hover:border-gold-2/80",
        )}
      />
      <span className="absolute inset-[3px] rounded-[2px] border border-gold/20" />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

export function Header({
  onHistory,
  onNewChat,
  onMemory,
  onAccount,
  historyOpen,
  memoryCount,
  user,
}: Props) {
  const { ref, w, h } = useSize<HTMLElement>();
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <header ref={ref} className="relative z-20 h-[96px] shrink-0">
      <HeaderArch w={w} h={h} />

      {/* Left controls */}
      <div className="absolute left-6 top-6 flex items-center gap-3">
        <SmallButton onClick={onHistory} active={historyOpen}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
            <path d="M3.5 4.5v4.2h4.2" />
            <path d="M12 7.5V12l3.2 2" />
          </svg>
          <span className="hidden sm:inline">History</span>
        </SmallButton>
        <SmallButton onClick={onNewChat}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M12 4v16M4 12h16" />
          </svg>
          <span className="hidden sm:inline">New</span>
        </SmallButton>
      </div>

      {/* Center Title */}
      <div className="pointer-events-none absolute left-1/2 top-[68px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <h1
          className="title-glow font-display text-[48px] leading-none tracking-tight text-cream select-none"
          aria-label="D'Ai"
        >
          D’Ai
        </h1>
      </div>

      {/* Right controls */}
      <div className="absolute right-6 top-6 flex items-center gap-3">
        <SmallButton onClick={onMemory} active={false}>
          <span className="text-[16px]">🧠</span>
          <span className="hidden sm:inline">Memory</span>
          {memoryCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full border border-gold/40 bg-gold/20 px-1 text-[10.5px] font-bold text-gold">
              {memoryCount}
            </span>
          )}
        </SmallButton>
        <SmallButton onClick={onAccount} active={Boolean(user)}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="User" className="h-5 w-5 rounded-full border border-gold/50 object-cover" />
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
          <span className="hidden sm:inline">{user ? "Account" : "Sign In"}</span>
        </SmallButton>
      </div>
    </header>
  );
}
