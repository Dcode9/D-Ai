import { useState, useMemo } from "react";
import type { Conversation } from "../hooks/useChat";
import { cn } from "../utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat?: () => void;
};

const fmt = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function HistoryDrawer({ open, onClose, conversations, activeId, onOpen, onDelete, onNewChat }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const titleMatch = (c.title || "").toLowerCase().includes(q);
      const contentMatch = (c.messages || []).some((m) =>
        (m.content || "").toLowerCase().includes(q),
      );
      return titleMatch || contentMatch;
    });
  }, [conversations, searchQuery]);

  const groups = useMemo(() => {
    const day = 86400000;
    const startToday = new Date(new Date().toDateString()).getTime();
    const order = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];
    const map = new Map<string, Conversation[]>();
    [...filteredConversations]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .forEach((c) => {
        const t = c.createdAt || 0;
        const g = t >= startToday ? "Today" : t >= startToday - day ? "Yesterday" : t >= startToday - 7 * day ? "Previous 7 days" : t >= startToday - 30 * day ? "Previous 30 days" : "Older";
        map.set(g, [...(map.get(g) || []), c]);
      });
    return order.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }));
  }, [filteredConversations]);

  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-30 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 z-40 flex h-full w-[min(330px,86vw)] flex-col border-r border-gold/20 bg-[#17150f] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[8px_0_40px_rgba(0,0,0,.6)] transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-white/10 bg-white/[.05] transition-colors focus-within:border-gold/50">
            <svg className="ml-3 h-4 w-4 shrink-0 text-cream/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              className="h-10 w-full bg-transparent px-2.5 font-body text-[15px] text-cream outline-none placeholder:text-muted/70"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="mr-2.5 cursor-pointer text-cream/50 hover:text-cream" aria-label="Clear search">
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-cream/60 transition-all hover:bg-white/[.07] hover:text-cream active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {onNewChat && (
          <button
            type="button"
            onClick={() => { try { navigator.vibrate?.(8); } catch {} onNewChat(); onClose(); }}
            className="mx-3 mb-2 flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 font-body text-[15.5px] text-cream transition-all hover:bg-white/[.07] active:scale-[0.98]"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            New chat
          </button>
        )}

        <div className="scroll-gold min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 && (
            <p className="px-3 pt-4 font-body text-[14.5px] leading-relaxed text-muted">No chats yet. Your conversations with D’Ai will show up here.</p>
          )}
          {conversations.length > 0 && filteredConversations.length === 0 && (
            <p className="px-3 pt-4 font-body text-[14px] leading-relaxed text-muted">No chats matching “{searchQuery}”.</p>
          )}

          {groups.map((g) => (
            <div key={g.label} className="mb-2">
              <div className="px-3 pb-1 pt-3 font-body text-[12px] font-medium tracking-wide text-muted">{g.label}</div>
              <ul>
                {g.items.map((c) => (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => { onOpen(c.id); onClose(); }}
                      className={cn(
                        "block w-full cursor-pointer rounded-xl px-3 py-2.5 pr-10 text-left transition-colors active:bg-white/[.1]",
                        c.id === activeId ? "bg-white/[.09]" : "hover:bg-white/[.05]",
                      )}
                    >
                      <span className="line-clamp-1 font-body text-[15px] text-cream">{c.title || "New chat"}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Delete chat"
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-cream/30 transition-colors hover:bg-white/[.08] hover:text-rose-300 md:text-transparent md:group-hover:text-cream/50"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
