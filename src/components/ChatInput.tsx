import { useState, type FormEvent } from "react";
import { useSize } from "../hooks/useSize";
import { INPUT_CAP, INPUT_DIAMOND, InputFrame } from "./frames/InputFrame";
import type { Mode } from "../hooks/useChat";
import { cn } from "../utils/cn";

type Props = { onSend: (text: string) => void; busy: boolean; mode: Mode | null };

const HINT: Record<Mode, string> = {
  Image: "Describe the image you envision…",
  Video: "Describe the scene to storyboard…",
  Code: "What shall we build?",
  Text: "What shall we write?",
  Music: "Describe the mood, tempo, instruments…",
};

export function ChatInput({ onSend, busy, mode }: Props) {
  const { ref, w, h } = useSize<HTMLFormElement>();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || busy) return;
    onSend(value);
    setValue("");
  };

  return (
    <form
      ref={ref}
      onSubmit={submit}
      className="relative mx-auto h-[112px] w-full max-w-[760px]"
      style={{ paddingLeft: INPUT_CAP, paddingRight: INPUT_CAP, paddingTop: INPUT_DIAMOND, paddingBottom: INPUT_DIAMOND }}
    >
      <InputFrame w={w} h={h} focused={focused} busy={busy} />

      <div className="relative z-10 flex h-full items-center gap-3 pl-8 pr-6">
        {mode && (
          <span className="hidden shrink-0 rounded-sm border border-gold/40 px-2 py-[2px] font-body text-[13px] uppercase tracking-[0.18em] text-gold-2/90 sm:inline-block">
            {mode}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={busy ? "D’Ai is composing…" : mode ? HINT[mode] : "Message D’Ai…"}
          className="h-full min-w-0 flex-1 bg-transparent font-body text-[22px] font-light tracking-wide text-cream outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-label="Send"
          className={cn(
            "group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-cream transition-all duration-300",
            "disabled:cursor-default disabled:opacity-50",
            "enabled:hover:translate-x-1 enabled:hover:text-[#fff3d6]",
          )}
        >
          <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10h25" />
            <path d="M19 3l8 7-8 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
