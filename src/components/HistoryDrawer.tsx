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
          "absolute left-0 top-0 z-40 flex h-full w-[340px] flex-col bg-ink-2/95 shadow-[0_0_60px_rgba(0,0,0,.6)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pointer-events-none absolute inset-3 border border-gold/40" />
        <div className="pointer-events-none absolute inset-[15px] border border-gold/15" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-8 pb-3 pt-8">
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

        {/* History Search Bar */}
        <div className="relative mx-7 mb-2">
          <div className="relative flex items-center rounded border border-gold/30 bg-black/40 transition-colors focus-within:border-gold">
            <svg
              className="ml-3 h-3.5 w-3.5 shrink-0 text-gold/60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chronicles…"
              className="w-full bg-transparent px-2.5 py-1.5 font-body text-[14px] text-cream outline-none placeholder:italic placeholder:text-muted/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mr-2.5 cursor-pointer text-gold/50 hover:text-cream text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="relative mx-8 h-px bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />

        <div className="scroll-gold relative flex-1 overflow-y-auto px-6 py-4">
          {conversations.length === 0 && (
            <p className="px-2 pt-4 font-body text-[16px] italic leading-relaxed text-muted">
              No conversations yet. Your exchanges with D’Ai will be kept here.
            </p>
          )}

          {conversations.length > 0 && filteredConversations.length === 0 && (
            <p className="px-2 pt-4 font-body text-[14px] italic leading-relaxed text-muted">
              No chronicles matching “{searchQuery}”.
            </p>
          )}

          <ul className="space-y-1">
            {filteredConversations.map((c) => (
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
