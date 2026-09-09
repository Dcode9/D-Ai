import { useState, useEffect } from "react";
import { derivePromptSuggestions, getMemory, type PromptSuggestion } from "../lib/memory";
import type { Conversation } from "../hooks/useChat";

type Props = {
  conversations: Conversation[];
  onSelectPrompt: (prompt: string) => void;
};

export function PromptSuggestions({ conversations, onSelectPrompt }: Props) {
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);

  useEffect(() => {
    const memoryFacts = getMemory();
    const list = derivePromptSuggestions(conversations, memoryFacts);
    setSuggestions(list);

    const onMemoryUpdate = (e: any) => {
      const updatedFacts = Array.isArray(e.detail) ? e.detail : getMemory();
      setSuggestions(derivePromptSuggestions(conversations, updatedFacts));
    };

    window.addEventListener("dai:memory-updated", onMemoryUpdate);
    return () => window.removeEventListener("dai:memory-updated", onMemoryUpdate);
  }, [conversations]);

  // If nothing is mentioned / no context or history exists, keep blank per user mandate
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="rise w-full max-w-2xl px-4 select-none">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            className="group relative flex cursor-pointer flex-col items-start rounded-md border border-gold/25 bg-black/40 p-3.5 text-left transition-all duration-200 hover:border-gold/60 hover:bg-gold/[0.08] hover:shadow-[0_4px_20px_rgba(201,168,106,0.12)] active:scale-[0.98]"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="font-display text-[14px] font-medium tracking-wide text-cream transition-colors group-hover:text-gold-2">
                {item.title}
              </span>
              <svg
                className="h-3.5 w-3.5 shrink-0 text-gold/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gold"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>
            {item.desc && (
              <p className="mt-1 line-clamp-1 font-body text-[12px] text-muted transition-colors group-hover:text-cream/80">
                {item.desc}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
