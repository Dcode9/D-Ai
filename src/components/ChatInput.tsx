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
  const [boxWidth, setBoxWidth] = useState(780);

  // Proportional multi-dimensional scaling for multi-line prompts
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    const scrollH = textareaRef.current.scrollHeight;
    textareaRef.current.style.height = `${Math.min(125, Math.max(34, scrollH))}px`;

    // Scale up in BOTH dimensions proportionally when more content is entered
    if (scrollH <= 38) {
      setBoxHeight(100);
      setBoxWidth(780);
    } else if (scrollH <= 66) {
      setBoxHeight(122);
      setBoxWidth(815);
    } else if (scrollH <= 96) {
      setBoxHeight(146);
      setBoxWidth(850);
    } else {
      setBoxHeight(170);
      setBoxWidth(885);
    }
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
    setBoxWidth(780);
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
      style={{
        height: `${boxHeight}px`,
        maxWidth: `min(${boxWidth}px, calc(100vw - 2rem))`,
      }}
      className="relative mx-auto w-full transition-[height,max-width] duration-250 ease-out"
    >
      <InputFrame w={w} h={h} focused={focused} busy={busy} mode={mode} />

      {/* Content strictly padded inside heraldic caps and rails */}
      <div
        style={{
          paddingLeft: `${Math.max(76, Math.round(94 * Math.min((boxHeight * 0.94) / 98, (boxWidth * 0.42) / 94) + 14))}px`,
          paddingRight: `${Math.max(68, Math.round(94 * Math.min((boxHeight * 0.94) / 98, (boxWidth * 0.42) / 94) + 8))}px`,
        }}
        className="relative z-10 flex h-full items-center gap-3 py-3"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={busy ? "D’Ai is composing…" : "Message D’Ai… (Shift+Enter for newline)"}
          className="scroll-gold max-h-[115px] min-h-[34px] w-full resize-none bg-transparent font-body text-[17px] md:text-[18.5px] font-light leading-relaxed tracking-wide text-cream outline-none placeholder:text-muted/60"
          autoComplete="off"
          spellCheck={false}
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop composing"
            aria-label="Stop composing"
            className="group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-gold-2 transition-transform duration-200 hover:scale-105 active:scale-95 self-center"
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
              "group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-cream transition-all duration-300 self-center",
              "disabled:cursor-default disabled:opacity-40",
              "enabled:hover:translate-x-1 enabled:hover:text-[#fff3d6]",
            )}
          >
            <svg width="26" height="18" viewBox="0 0 30 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 10h25" />
              <path d="M19 3l8 7-8 7" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
