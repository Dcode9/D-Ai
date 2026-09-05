import type { Conversation } from "../hooks/useChat";
import { cn } from "../utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

const fmt = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function HistoryDrawer({ open, onClose, conversations, activeId, onOpen, onDelete }: Props) {
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-30 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 z-40 flex h-full w-[320px] flex-col bg-ink-2/95 shadow-[0_0_60px_rgba(0,0,0,.6)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pointer-events-none absolute inset-3 border border-gold/40" />
        <div className="pointer-events-none absolute inset-[15px] border border-gold/15" />

        <div className="relative flex items-center justify-between px-8 pb-4 pt-8">
          <h2 className="font-display text-[30px] text-cream">History</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-gold/70 transition-colors hover:text-cream"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="relative mx-8 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />

        <div className="scroll-gold relative flex-1 overflow-y-auto px-6 py-4">
          {conversations.length === 0 && (
            <p className="px-2 pt-4 font-body text-[16px] italic leading-relaxed text-muted">
              No conversations yet. Your exchanges with D’Ai will be kept here.
            </p>
          )}
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    onOpen(c.id);
                    onClose();
                  }}
                  className={cn(
                    "w-full cursor-pointer rounded-sm px-3 py-3 text-left transition-colors",
                    c.id === activeId ? "bg-gold/10" : "hover:bg-white/[.04]",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="line-clamp-1 font-body text-[17px] text-cream">{c.title}</span>
                    <span className="shrink-0 font-body text-[12px] uppercase tracking-[0.15em] text-muted">
                      {fmt(c.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-1 font-body text-[14px] font-light text-muted">
                    {c.messages.find((m) => m.role === "assistant")?.content.replace(/```[\s\S]*?```/g, "[code]") ?? "—"}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  className="absolute right-2 top-3 cursor-pointer p-1 text-gold/0 transition-colors hover:!text-cream group-hover:text-gold/60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
