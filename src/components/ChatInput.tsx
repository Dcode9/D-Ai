import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { useSize } from "../hooks/useSize";
import { InputFrame } from "./frames/InputFrame";
import type { Mode } from "../hooks/useChat";
import { cn } from "../utils/cn";

type Props = {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy: boolean;
  mode?: Mode | null;
  onOpenStudio?: () => void;
};

export function ChatInput({ onSend, onStop, busy, mode, onOpenStudio }: Props) {
  const { ref, w, h } = useSize<HTMLFormElement>();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boxHeight, setBoxHeight] = useState(100);
  const [boxWidth, setBoxWidth] = useState(780);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

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
    const trimmed = value.trim();
    if ((!trimmed && !attachedImage) || busy) return;

    let finalPrompt = trimmed;
    if (attachedImage) {
      finalPrompt = `[UPLOADED_IMAGE: ${attachedImage}]\n${trimmed || "Analyze this image and generate the implementation."}`;
    }

    onSend(finalPrompt);
    setValue("");
    setAttachedImage(null);
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

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <form
      ref={ref}
      onSubmit={submit}
      style={{
        height: `${boxHeight + (attachedImage ? 42 : 0)}px`,
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
        className="relative z-10 flex h-full flex-col justify-center gap-1.5 py-3"
      >
        {/* Attached thumbnail preview if uploaded */}
        {attachedImage && (
          <div className="flex items-center gap-2">
            <div className="relative inline-flex items-center gap-1.5 rounded border border-gold/40 bg-black/60 px-2 py-0.5 text-xs text-gold-2">
              <img src={attachedImage} alt="Attachment" className="h-5 w-5 rounded object-cover border border-gold/40" />
              <span className="font-mono text-[11px]">Image attached (Groq Vision)</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="cursor-pointer text-gold/60 hover:text-rose-300 ml-1"
                title="Remove image"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex w-full items-center gap-2.5">
          {/* File Upload Hidden Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Attachment / Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image for Groq Vision analysis"
            className="cursor-pointer text-gold/50 transition-colors hover:text-gold active:scale-95 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Code Studio Quick-Trigger Button */}
          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              title="Open Code Studio Sidebar"
              className="cursor-pointer text-gold/50 transition-colors hover:text-gold active:scale-95 shrink-0"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
          )}

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
              disabled={!value.trim() && !attachedImage}
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
      </div>
    </form>
  );
}
