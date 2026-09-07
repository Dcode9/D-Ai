import { useSize } from "../hooks/useSize";
import { HeaderArch } from "./frames/HeaderArch";
import { cn } from "../utils/cn";

type Props = { onHistory: () => void; onNewChat: () => void; historyOpen: boolean };

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
        "group relative flex h-[38px] cursor-pointer items-center gap-2 px-4 font-body text-[17px] text-cream/90 outline-none transition-colors",
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

export function Header({ onHistory, onNewChat, historyOpen }: Props) {
  const { ref, w, h } = useSize<HTMLElement>();
  return (
    <header ref={ref} className="relative z-20 h-[96px] shrink-0">
      <HeaderArch w={w} h={h} />

      <div className="absolute left-7 top-6 flex items-center gap-4">
        <SmallButton onClick={onHistory} active={historyOpen}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
            <path d="M3.5 4.5v4.2h4.2" />
            <path d="M12 7.5V12l3.2 2" />
          </svg>
          History
        </SmallButton>
        <SmallButton onClick={onNewChat}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M12 4v16M4 12h16" />
          </svg>
          New Chat
        </SmallButton>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-[28px] -translate-x-1/2 flex flex-col items-center">
        <h1
          className="title-glow font-display text-[48px] leading-none tracking-tight text-cream"
          aria-label="D'Ai"
        >
          D’Ai
        </h1>
      </div>
    </header>
  );
}
