import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ChangeEvent } from "react";
import type { Mode } from "../hooks/useChat";
import { cn } from "../utils/cn";

type Props = {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy: boolean;
  mode?: Mode | null;
  onOpenStudio?: () => void;
};

const IC = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function buzz(ms: number | number[] = 8) {
  try { navigator.vibrate?.(ms); } catch {}
}

export function ChatInput({ onSend, onStop, busy, onOpenStudio }: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [hd, setHd] = useState(() => typeof localStorage !== "undefined" && localStorage.getItem("dai-hd") !== "0");
  const toggleHd = () => {
    const next = !hd;
    setHd(next);
    try { localStorage.setItem("dai-hd", next ? "1" : "0"); } catch {}
    buzz(next ? [12, 30, 12] : 10);
  };

  // Continuous auto-grow like ChatGPT: follows the text line by line, then scrolls past a cap.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = Math.max(96, Math.min(window.innerWidth < 640 ? 150 : 220, Math.round(window.innerHeight * 0.32)));
    el.style.height = `${Math.min(maxH, Math.max(28, el.scrollHeight))}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, [value]);

  // "Edit" on a past message drops its text back into the box
  useEffect(() => {
    const onEdit = (e: Event) => {
      const t = (e as CustomEvent).detail?.text as string | undefined;
      if (t == null) return;
      setValue(t);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) { el.focus(); el.setSelectionRange(t.length, t.length); }
      });
    };
    window.addEventListener("dai:edit", onEdit);
    return () => window.removeEventListener("dai:edit", onEdit);
  }, []);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) {
      onStop?.();
      return;
    }
    const trimmed = value.trim();
    if (!trimmed && !attachedImage) return;
    let finalPrompt = trimmed;
    if (attachedImage) {
      finalPrompt = `[UPLOADED_IMAGE: ${attachedImage}]\n${trimmed || "Analyze this image and generate the implementation."}`;
    }
    buzz(10);
    onSend(finalPrompt);
    setValue("");
    setAttachedImage(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth >= 640) {
      e.preventDefault();
      submit();
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setAttachedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const canSend = Boolean(value.trim() || attachedImage);

  return (
    <form
      onSubmit={submit}
      className={cn(
        "relative mx-auto w-full max-w-[768px] rounded-[26px] border bg-[#1d1b17]/95 px-3 pb-2.5 pt-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur transition-all duration-200",
        focused ? "border-gold/60 shadow-[0_8px_34px_rgba(201,168,106,0.16)]" : "border-gold/25",
      )}
    >
      {attachedImage && (
        <div className="mb-2 flex">
          <div className="relative">
            <img src={attachedImage} alt="Attachment" className="h-16 w-16 rounded-xl border border-gold/30 object-cover" />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              aria-label="Remove image"
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gold/40 bg-ink text-[12px] text-cream"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={busy ? "D’Ai is composing…" : "Message D’Ai"}
        enterKeyHint="send"
        className="scroll-gold block max-h-[220px] min-h-[28px] w-full resize-none bg-transparent px-1.5 font-body text-[16px] leading-[1.55] text-cream outline-none placeholder:text-muted/60"
        autoComplete="off"
        spellCheck={false}
      />

      <div className="mt-1.5 flex items-center gap-1">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <button
          type="button"
          onClick={() => { buzz(); fileInputRef.current?.click(); }}
          title="Attach an image"
          aria-label="Attach an image"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-cream/60 transition-all hover:bg-white/[.07] hover:text-cream active:scale-90"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" {...IC}><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {onOpenStudio && (
          <button
            type="button"
            onClick={() => { buzz(); onOpenStudio(); }}
            title="Open Code Studio"
            aria-label="Open Code Studio"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-cream/60 transition-all hover:bg-white/[.07] hover:text-cream active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" {...IC}><path d="M16 18l6-6-6-6" /><path d="M8 6l-6 6 6 6" /></svg>
          </button>
        )}
        <button
          type="button"
          onClick={toggleHd}
          aria-pressed={hd}
          title={hd ? "HD images on (GPT Image 2). Tap for fast mode" : "Fast images (Z-Image Turbo). Tap for HD"}
          className={cn(
            "flex h-8 shrink-0 cursor-pointer items-center rounded-full border px-3 font-display text-[12px] tracking-widest transition-all active:scale-90",
            hd ? "border-gold bg-gold/20 text-[#fff3d6] shadow-[0_0_12px_rgba(201,168,106,0.35)]" : "border-white/15 text-cream/50 hover:text-cream",
          )}
        >
          {hd ? "HD" : "FAST"}
        </button>

        <div className="flex-1" />

        {busy ? (
          <button
            type="button"
            onClick={() => { buzz([10, 20, 10]); onStop?.(); }}
            title="Stop"
            aria-label="Stop"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#f1deb0] to-[#c9a86a] text-ink shadow-[0_0_16px_rgba(201,168,106,0.4)] transition-transform active:scale-90"
          >
            <span className="h-3.5 w-3.5 rounded-[3px] bg-ink" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            title="Send"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90",
              canSend
                ? "cursor-pointer bg-gradient-to-br from-[#f1deb0] to-[#c9a86a] text-ink shadow-[0_0_16px_rgba(201,168,106,0.35)] hover:scale-105"
                : "cursor-default bg-white/[.08] text-cream/30",
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" {...IC} strokeWidth={2.2}><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </div>
    </form>
  );
}
