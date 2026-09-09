import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useSize } from "../hooks/useSize";
import { InputFrame } from "./frames/InputFrame";
import type { Mode } from "../hooks/useChat";
import { cn } from "../utils/cn";

type Props = {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy: boolean;
  mode?: Mode | null;
};

export function ChatInput({ onSend, onStop, busy, mode }: Props) {
  const { ref, w, h } = useSize<HTMLFormElement>();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [boxHeight, setBoxHeight] = useState(100);

  // Auto-resize vertical stretch logic
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    const scrollH = textareaRef.current.scrollHeight;
    textareaRef.current.style.height = `${Math.min(130, Math.max(34, scrollH))}px`;
    const targetHeight = Math.min(210, Math.max(100, scrollH + 48));
    setBoxHeight(targetHeight);
  }, [value]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy && onStop) {
      onStop();
      return;
    }
    if (!value.trim() || busy) return;
    onSend(value);
    setValue("");
    setBoxHeight(100);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      ref={ref}
      onSubmit={submit}
      style={{ height: `${boxHeight}px` }}
      className="relative mx-auto w-full max-w-[780px] transition-[height] duration-200 ease-out"
    >
      <InputFrame w={w} h={h} focused={focused} busy={busy} mode={mode} />

      <div className="relative z-10 flex h-full items-center gap-3 px-10 md:px-16 py-3">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={busy ? "D’Ai is composing…" : "Message D’Ai… (Shift+Enter for newline)"}
          className="scroll-gold max-h-[140px] min-h-[36px] w-full resize-none bg-transparent font-body text-[19px] md:text-[21px] font-light leading-relaxed tracking-wide text-cream outline-none placeholder:text-muted/60"
          autoComplete="off"
          spellCheck={false}
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop composing"
            aria-label="Stop composing"
            className="group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-gold-2 transition-transform duration-200 hover:scale-105 active:scale-95 self-end mb-1"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/70 bg-gold/15 shadow-[0_0_12px_rgba(201,168,106,0.35)]">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[#e8d3a0]" />
            </span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
            className={cn(
              "group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-cream transition-all duration-300 self-end mb-1",
              "disabled:cursor-default disabled:opacity-40",
              "enabled:hover:translate-x-1 enabled:hover:text-[#fff3d6]",
            )}
          >
            <svg width="28" height="20" viewBox="0 0 30 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10h25" />
              <path d="M19 3l8 7-8 7" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
