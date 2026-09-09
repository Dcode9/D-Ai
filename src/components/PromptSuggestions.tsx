import { useState, useEffect } from "react";
import { derivePromptSuggestions, getMemoryTopics, type PromptSuggestion } from "../lib/memory";
import type { Conversation } from "../hooks/useChat";
import { StretchFrame } from "./frames/StretchFrame";
import { useSize } from "../hooks/useSize";

type Props = {
  conversations: Conversation[];
  onSelectPrompt: (prompt: string) => void;
};

interface SuggestionCardProps {
  suggestion: PromptSuggestion;
  onSelect: (prompt: string) => void;
}

function OrnateSuggestionBox({ suggestion, onSelect }: SuggestionCardProps) {
  const { ref, w, h } = useSize<HTMLButtonElement>();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(suggestion.prompt)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to explore this direction"
      className="group relative flex h-[56px] w-full cursor-pointer items-center justify-center px-8 transition-transform duration-200 hover:scale-[1.015] active:scale-[0.985]"
    >
      {/* Heraldic Ornate Frame */}
      <StretchFrame
        shape={suggestion.shapeId}
        w={w}
        h={h}
        active={hovered}
        glow={hovered}
        strokeWidth={hovered ? 1.7 : 1.3}
        showBackdrop={true}
        backdropOpacity={0.88}
        className="transition-all duration-300"
      />

      {/* 4-5 Word Preview Label (Full prompt is hidden) */}
      <div className="relative z-10 flex items-center justify-center gap-2 px-2 text-center select-none">
        <span className="font-display text-[13px] sm:text-[14px] font-medium tracking-[0.05em] text-cream/90 transition-colors group-hover:text-gold-2">
          {suggestion.preview}
        </span>
        <span className="text-[12px] text-gold/45 transition-all duration-200 group-hover:translate-x-1 group-hover:text-gold">
          →
        </span>
      </div>
    </button>
  );
}

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

  // If nothing is mentioned / no memory or context exists, keep blank per user mandate
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="rise w-full max-w-2xl px-4 select-none">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((item, idx) => (
          <OrnateSuggestionBox
            key={`${item.preview}-${idx}`}
            suggestion={item}
            onSelect={onSelectPrompt}
          />
        ))}
      </div>
    </div>
  );
}
