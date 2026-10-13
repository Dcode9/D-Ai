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

const NARROW_CAP = 0.62;

export function ChatInput({ onSend, onStop, busy, mode, onOpenStudio }: Props) {
  const { ref, w, h } = useSize<HTMLFormElement>();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boxHeight, setBoxHeight] = useState(100);
  const [boxWidth, setBoxWidth] = useState(780);
  const [hd, setHd] = useState(() => typeof localStorage !== "undefined" && localStorage.getItem("dai-hd") !== "0");
  const toggleHd = () => {
    const next = !hd;
    setHd(next);
    try { localStorage.setItem("dai-hd", next ? "1" : "0"); } catch {}
    try { navigator.vibrate?.(next ? [12, 30, 12] : 10); } catch {}
  };
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 640);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Continuous auto-grow like ChatGPT: the box follows the text line by line, then scrolls past a cap.
  const [taH, setTaH] = useState(34);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = Math.max(90, Math.min(narrow ? 120 : 200, Math.round(window.innerHeight * 0.3)));
    const h = Math.min(maxH, Math.max(34, el.scrollHeight));
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
    setTaH(h);
    document.documentElement.style.setProperty("--input-extra", `${Math.max(0, h - 34) + (h > 40 ? 40 : 0)}px`);
    setBoxHeight(h + 66);
    setBoxWidth(780);
  }, [value, narrow]);

  const multi = taH > 40;

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
    setTaH(34);
    setBoxHeight(100);
    if (textareaRef.current) {
      textareaRef.current.style.height = "34px";
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
        height: `${taH + (narrow ? 28 : 66) + (multi ? 40 : 0) + (attachedImage ? 42 : 0)}px`,
        maxWidth: narrow ? "100%" : "min(780px, calc(100vw - 2rem))",
      }}
      className="relative mx-auto w-full transition-[height] duration-100 ease-out"
    >
      <button
            type="button"
            onClick={toggleHd}
            aria-pressed={hd}
            title={hd ? "HD images on (GPT Image 2). Tap for fast mode" : "Fast mode (Z-Image Turbo). Tap for HD"}
            className={cn(
              "absolute -top-4 right-7 z-20 flex h-8 min-w-[48px] cursor-pointer items-center justify-center rounded-full border bg-[#161514] px-3 font-display text-[12px] tracking-widest transition-all active:scale-90",
              hd ? "border-gold bg-gold/25 text-[#fff3d6] shadow-[0_0_12px_rgba(201,168,106,0.45)]" : "border-gold/30 text-gold/50 hover:text-gold",
            )}
          >
            {hd ? "HD" : "FAST"}
          </button>

      <InputFrame w={w} h={h} focused={focused} busy={busy} mode={mode} maxCapScale={narrow ? NARROW_CAP : 1.15} />

      {/* Content strictly padded inside heraldic caps and rails */}
      <div
        style={narrow ? { paddingLeft: Math.round(94 * NARROW_CAP) + 4, paddingRight: Math.round(94 * NARROW_CAP) - 6 } : {
          paddingLeft: `${Math.max(76, Math.round(94 * Math.min((Math.min(boxHeight, 118) * 0.94) / 98, (boxWidth * 0.42) / 94) + 14))}px`,
          paddingRight: `${Math.max(68, Math.round(94 * Math.min((Math.min(boxHeight, 118) * 0.94) / 98, (boxWidth * 0.42) / 94) + 8))}px`,
        }}
        className={cn("relative z-10 flex h-full flex-col justify-center gap-1.5 py-2.5 md:py-3", multi && "pt-4 md:pt-5")}
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

        <div className="flex w-full flex-wrap items-end gap-2.5">
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
            placeholder={busy ? "D’Ai is composing…" : narrow ? "Message D’Ai…" : "Message D’Ai… (Shift+Enter for newline)"}
            className={cn("scroll-gold min-h-[34px] resize-none bg-transparent font-body text-[16px] md:text-[18.5px] font-light leading-relaxed tracking-wide text-cream outline-none placeholder:text-muted/60", multi ? "order-first w-full basis-full" : "min-w-0 flex-1")}
            autoComplete="off"
            spellCheck={false}
          />

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop composing"
              aria-label="Stop composing"
              className={cn("group flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-gold-2 transition-transform duration-200 hover:scale-105 active:scale-95 self-end", multi && "ml-auto")}
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
                "group flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-cream transition-all duration-300 self-end",
                multi && "ml-auto",
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
