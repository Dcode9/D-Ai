import { useEffect, useState } from "react";
import { getMemory, addMemoryFact, removeMemoryFact, clearMemory } from "../lib/memory";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MemoryModal({ open, onClose }: Props) {
  const [facts, setFacts] = useState<string[]>(getMemory);
  const [newFact, setNewFact] = useState("");

  useEffect(() => {
    setFacts(getMemory());
    const onUpdate = (e: CustomEvent<string[]>) => {
      setFacts(e.detail || getMemory());
    };
    window.addEventListener("dai:memory-updated" as any, onUpdate);
    return () => window.removeEventListener("dai:memory-updated" as any, onUpdate);
  }, [open]);

  if (!open) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    const updated = addMemoryFact(newFact.trim());
    setFacts(updated);
    setNewFact("");
  };

  const handleRemove = (idx: number) => {
    const updated = removeMemoryFact(idx);
    setFacts(updated);
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you wish to clear all remembered personal facts?")) {
      clearMemory();
      setFacts([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark glass backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Ornate Modal Frame */}
      <div className="relative flex max-h-[85vh] w-full max-w-[500px] flex-col overflow-hidden rounded-xl border border-gold/40 bg-[#0c0910]/95 p-6 shadow-[0_12px_48px_rgba(0,0,0,0.85)] sm:p-7">
        {/* Double-rail heraldic borders */}
        <div className="pointer-events-none absolute inset-2 rounded-lg border border-gold/25" />
        <div className="pointer-events-none absolute inset-[11px] rounded border border-gold/10" />

        {/* Header */}
        <div className="relative mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl text-gold">🧠</span>
            <div>
              <h2 className="font-display text-[22px] tracking-[0.06em] text-cream">Personal Memory</h2>
              <p className="font-body text-[12px] text-muted">
                {facts.length} {facts.length === 1 ? "fact" : "facts"} remembered across sessions
              </p>
            </div>
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

        {/* Add Fact Form */}
        <form onSubmit={handleAdd} className="relative mb-4 flex gap-2">
          <input
            type="text"
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            placeholder="e.g. 'My preferred tech stack is TypeScript and Next.js'..."
            className="flex-1 rounded-lg border border-gold/30 bg-black/50 px-3.5 py-2 font-body text-[13.5px] text-cream placeholder-gold/35 focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newFact.trim()}
            className="cursor-pointer rounded-lg border border-gold/40 bg-gold/20 px-4 py-2 font-display text-[12.5px] uppercase tracking-[0.14em] text-cream transition-colors hover:bg-gold/30 disabled:opacity-40"
          >
            Remember
          </button>
        </form>

        {/* Facts List */}
        <div className="scroll-gold relative flex-1 overflow-y-auto pr-1">
          {facts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gold/25 p-6 text-center">
              <p className="font-body text-[14px] italic text-muted">
                No personal facts stored yet. You can manually enter facts above, or ask D'Ai in chat to remember details about you.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {facts.map((fact, idx) => (
                <li
                  key={idx}
                  className="group flex items-start justify-between gap-3 rounded-lg border border-gold/20 bg-white/[0.02] p-3 transition-colors hover:border-gold/40 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1 text-[10px] text-gold">◆</span>
                    <span className="font-body text-[13.5px] leading-relaxed text-[#ded4bf]">{fact}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="cursor-pointer text-gold/30 opacity-75 transition-all hover:text-rose-400 group-hover:opacity-100"
                    title="Remove fact"
                    aria-label="Remove fact"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {facts.length > 0 && (
          <div className="relative mt-4 flex items-center justify-between border-t border-gold/20 pt-3">
            <span className="font-body text-[11.5px] text-muted">Automatically injected into reasoning</span>
            <button
              type="button"
              onClick={handleClear}
              className="cursor-pointer font-display text-[11.5px] uppercase tracking-wider text-rose-400/80 transition-colors hover:text-rose-300"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
