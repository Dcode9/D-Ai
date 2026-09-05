import { useEffect, useRef, useState, useMemo } from "react";
import { marked, type Tokens } from "marked";
import type { Message } from "../hooks/useChat";
import { Aura, type AuraState } from "./Aura";
import { cn } from "../utils/cn";

type Props = { messages: Message[]; state: AuraState };

/** Custom CodeBlock component with language badge and copy action */
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-md border border-gold/35 bg-[#121110] shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-gold/20 bg-white/[0.03] px-4 py-1.5">
        <span className="font-display text-[13px] uppercase tracking-[0.2em] text-gold-2/80">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-0.5 font-body text-[12px] text-gold/70 transition-all hover:bg-gold/15 hover:text-cream active:scale-95"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="scroll-gold overflow-x-auto p-4 font-mono text-[14px] leading-relaxed text-[#f0e6d2]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Segmented Markdown Renderer combining marked tokens with custom CodeBlock components */
function RichMarkdown({ text, streaming, imageUrl }: { text: string; streaming?: boolean; imageUrl?: string }) {
  const renderedContent = useMemo(() => {
    if (!text.trim()) return null;

    try {
      const tokens = marked.lexer(text);
      const segments: React.ReactNode[] = [];
      let proseTokens: Tokens.Generic[] = [];

      const flushProse = (keyIndex: number) => {
        if (proseTokens.length === 0) return;
        try {
          const html = marked.parser(proseTokens as any);
          segments.push(
            <div
              key={`prose-${keyIndex}`}
              className="dai-prose"
              dangerouslySetInnerHTML={{ __html: html }}
            />,
          );
        } catch {
          // Fallback if parser encounters incomplete token
          segments.push(
            <div key={`prose-${keyIndex}`} className="dai-prose whitespace-pre-wrap">
              {proseTokens.map((t) => t.raw).join("")}
            </div>,
          );
        }
        proseTokens = [];
      };

      tokens.forEach((token, idx) => {
        if (token.type === "code") {
          flushProse(idx);
          segments.push(
            <CodeBlock key={`code-${idx}`} lang={token.lang || "code"} code={token.text} />,
          );
        } else {
          proseTokens.push(token);
        }
      });

      flushProse(tokens.length);
      return segments;
    } catch {
      return (
        <div className="dai-prose whitespace-pre-wrap">
          {text}
        </div>
      );
    }
  }, [text]);

  return (
    <div className="space-y-2">
      {renderedContent}
      {streaming && <span className="streaming-quill" title="Composing…" />}

      {imageUrl && (
        <div className="my-4 overflow-hidden rounded-md border border-gold/40 bg-black/60 p-2 shadow-[0_0_30px_rgba(201,168,106,0.18)]">
          <img
            src={imageUrl}
            alt="D'Ai visual output"
            className="max-h-[520px] w-auto rounded object-contain transition-transform duration-300 hover:scale-[1.01]"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

function UserBubble({ m }: { m: Message }) {
  return (
    <div className="rise flex justify-end">
      <div className="relative max-w-[85%] md:max-w-[72%] px-5 py-3.5">
        <span className="absolute inset-0 border border-gold/45" />
        {/* corner jewels */}
        {["-top-[3px] -left-[3px]", "-top-[3px] -right-[3px]", "-bottom-[3px] -left-[3px]", "-bottom-[3px] -right-[3px]"].map((c) => (
          <span key={c} className={cn("absolute h-[5px] w-[5px] rotate-45 bg-ink border border-gold/80", c)} />
        ))}
        <div className="relative">
          {m.mode && (
            <div className="mb-1 font-body text-[11px] uppercase tracking-[0.22em] text-gold/70">
              {m.mode}
            </div>
          )}
          <p className="whitespace-pre-wrap font-body text-[18.5px] font-light leading-relaxed text-cream">
            {m.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function AssistantRow({
  m,
  isLatest,
  rowRef,
}: {
  m: Message;
  isLatest: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    navigator.clipboard?.writeText(m.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={isLatest ? rowRef : undefined} className="rise flex items-start gap-4">
      <Aura state={m.streaming ? "answering" : "idle"} size={44} className="mt-1 shrink-0" ring={false} />

      <div className="min-w-0 max-w-[82%] flex-1 pt-1.5 font-body">
        <RichMarkdown text={m.content} streaming={m.streaming} imageUrl={m.imageUrl} />

        {/* Action bar on completed responses */}
        {!m.streaming && m.content && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={copyAll}
              className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-gold/25 px-2.5 py-1 font-body text-[12px] text-gold/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-cream active:scale-95"
              aria-label="Copy full response"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Messages({ messages, state }: Props) {
  const latestRowRef = useRef<HTMLDivElement | null>(null);
  const scrolledAssistantIdRef = useRef<string | null>(null);

  // Requirement: "still not scrolling to the latest, only till the top of the answer on the top"
  // When a new assistant response appears, smoothly scroll ONCE to the top of that answer row.
  // During token streaming, DO NOT scroll to bottom so the user can read from line 1 comfortably!
  useEffect(() => {
    const latestAssistant = messages.findLast((m) => m.role === "assistant");
    if (latestAssistant && latestAssistant.id !== scrolledAssistantIdRef.current) {
      scrolledAssistantIdRef.current = latestAssistant.id;
      // Scroll to the TOP of the answer
      if (latestRowRef.current) {
        latestRowRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  }, [messages]);

  const lastAssistant = messages.findLast((m) => m.role === "assistant");

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-4 py-8 md:px-10">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} m={m} />
        ) : (
          <AssistantRow
            key={m.id}
            m={m}
            isLatest={m.id === lastAssistant?.id}
            rowRef={(el) => {
              if (m.id === lastAssistant?.id) {
                latestRowRef.current = el;
              }
            }}
          />
        ),
      )}

      {state === "thinking" && (
        <div className="rise flex items-center gap-4 pt-2">
          <Aura state="thinking" size={44} className="shrink-0" ring={false} />
          <span className="shimmer-text font-display text-[21px] italic tracking-wide">
            Thinking…
          </span>
        </div>
      )}
    </div>
  );
}
