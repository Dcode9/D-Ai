import { useEffect, useRef, useState } from "react";
import type { Message } from "../hooks/useChat";
import { Aura, type AuraState } from "./Aura";
import { cn } from "../utils/cn";

type Props = { messages: Message[]; state: AuraState };

/** Renders text with ```code``` fences, images, and paragraph breaks. */
function Rich({ text, streaming, imageUrl }: { text: string; streaming?: boolean; imageUrl?: string }) {
  const parts = text.split(/```(\w*)\n?([\s\S]*?)(```|$)/g);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i += 4) {
    const prose = parts[i];
    if (prose?.trim()) {
      // Check for markdown image syntax: ![alt](url)
      const imageMatch = prose.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch) {
        const alt = imageMatch[1] || "Generated image";
        const url = imageMatch[2];
        nodes.push(
          <div key={`img-${i}`} className="my-3 overflow-hidden rounded-md border border-gold/40 bg-black/50 p-1.5 shadow-[0_0_24px_rgba(201,168,106,0.15)]">
            <img src={url} alt={alt} className="max-h-[500px] w-auto rounded object-contain" loading="lazy" />
          </div>
        );
      } else {
        prose.split(/\n{2,}/).forEach((p, j) =>
          nodes.push(
            <p key={`${i}-${j}`} className="whitespace-pre-wrap">
              {p}
            </p>,
          ),
        );
      }
    }
    const code = parts[i + 2];
    if (code !== undefined) {
      nodes.push(
        <CodeBlock key={`c-${i}`} lang={parts[i + 1] || "code"} code={code.replace(/\n$/, "")} />
      );
    }
  }

  if (imageUrl) {
    nodes.push(
      <div key="attached-img" className="my-3 overflow-hidden rounded-md border border-gold/40 bg-black/50 p-1.5 shadow-[0_0_24px_rgba(201,168,106,0.15)]">
        <img src={imageUrl} alt="Generated visual" className="max-h-[500px] w-auto rounded object-contain" loading="lazy" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", streaming && "caret")}>
      {nodes}
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <pre className="group relative my-2 overflow-x-auto rounded-sm border border-gold/30 bg-black/40 px-4 py-3 font-mono text-[13.5px] leading-relaxed text-[#e6d9bd]">
      <div className="absolute right-2 top-1.5 flex items-center gap-2">
        <span className="font-body text-[11px] uppercase tracking-[0.2em] text-gold/60">
          {lang}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded px-1.5 py-0.5 font-body text-[11px] text-gold/60 transition-colors hover:bg-gold/15 hover:text-cream"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code>{code}</code>
    </pre>
  );
}

function UserBubble({ m }: { m: Message }) {
  return (
    <div className="rise flex justify-end">
      <div className="relative max-w-[70%] px-5 py-3">
        <span className="absolute inset-0 border border-gold/45" />
        {/* corner jewels */}
        {["-top-[3px] -left-[3px]", "-top-[3px] -right-[3px]", "-bottom-[3px] -left-[3px]", "-bottom-[3px] -right-[3px]"].map((c) => (
          <span key={c} className={cn("absolute h-[5px] w-[5px] rotate-45 bg-ink border border-gold/80", c)} />
        ))}
        <div className="relative">
          {m.mode && (
            <div className="mb-1 font-body text-[11px] uppercase tracking-[0.22em] text-gold/70">{m.mode}</div>
          )}
          <p className="whitespace-pre-wrap font-body text-[18px] font-light leading-relaxed text-cream">{m.content}</p>
        </div>
      </div>
    </div>
  );
}

function AssistantRow({ m }: { m: Message }) {
  return (
    <div className="rise flex items-start gap-4">
      <Aura state={m.streaming ? "answering" : "idle"} size={46} className="mt-1 shrink-0" ring={false} />
      <div className="max-w-[78%] pt-2 font-body text-[18px] font-light leading-relaxed text-cream/95">
        <Rich text={m.content} streaming={m.streaming} imageUrl={m.imageUrl} />
      </div>
    </div>
  );
}

export function Messages({ messages, state }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastLen = messages[messages.length - 1]?.content.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastLen, state]);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-7 px-6 py-8 md:px-10">
      {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} m={m} /> : <AssistantRow key={m.id} m={m} />))}

      {state === "thinking" && (
        <div className="rise flex items-center gap-4">
          <Aura state="thinking" size={46} className="shrink-0" ring={false} />
          <span className="shimmer-text font-display text-[20px] italic tracking-wide">Thinking…</span>
        </div>
      )}
      <div ref={endRef} className="h-2" />
    </div>
  );
}
