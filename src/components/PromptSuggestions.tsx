import { useState, useEffect } from "react";
import { derivePromptSuggestions, getMemoryTopics, type PromptSuggestion } from "../lib/memory";
import type { Conversation } from "../hooks/useChat";

type Props = {
  conversations: Conversation[];
  onSelectPrompt: (prompt: string) => void;
};

export function PromptSuggestions({ conversations, onSelectPrompt }: Props) {
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);

  useEffect(() => {
    const topics = getMemoryTopics();
    const list = derivePromptSuggestions(conversations, topics);
    setSuggestions(list);

    const onMemoryUpdate = () => {
      const updatedTopics = getMemoryTopics();
      setSuggestions(derivePromptSuggestions(conversations, updatedTopics));
    };

    window.addEventListener("dai:memory-updated", onMemoryUpdate);
    return () => window.removeEventListener("dai:memory-updated", onMemoryUpdate);
  }, [conversations]);

  const defaults: PromptSuggestion[] = [
    { preview: "Make an image", prompt: "Make me a stunning image of a golden dragon over a misty mountain at sunrise" },
    { preview: "Write some code", prompt: "Build a small, beautiful to-do app in one HTML file" },
    { preview: "Explain something", prompt: "Explain how black holes work in simple terms" },
    { preview: "Plan my day", prompt: "Help me plan a productive day, ask me what I need to get done" },
  ] as PromptSuggestion[];
  const list = defaults;

  return (
    <div className="rise flex w-full flex-wrap items-center justify-center gap-2.5 select-none">
      {list.map((item, idx) => (
        <button
          key={`${item.preview}-${idx}`}
          type="button"
          onClick={() => { try { navigator.vibrate?.(8); } catch {} onSelectPrompt(item.prompt); }}
          className="cursor-pointer rounded-full border border-gold/30 bg-white/[.035] px-4 py-2.5 font-body text-[14.5px] text-cream/90 transition-all hover:border-gold/60 hover:bg-gold/10 hover:text-cream active:scale-95"
        >
          {item.preview}
        </button>
      ))}
    </div>
  );
}
