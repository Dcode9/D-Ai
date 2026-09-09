import { useEffect, useRef, useState, useMemo } from "react";
import { marked, type Tokens } from "marked";
import type { Message, WorkData, WorkStep, SearchResult } from "../hooks/useChat";
import { Aura, type AuraState } from "./Aura";
import { cn } from "../utils/cn";

type Props = { messages: Message[]; state: AuraState };

function formatDuration(sec: number): string {
  if (!sec || sec < 1) return "a while";
  const rounded = Math.round(sec);
  return `${rounded} second${rounded === 1 ? "" : "s"}`;
}

/** Chevron icon helper */
function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", open ? "rotate-180" : "rotate-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Individual Accordion for a Thought step */
function ThoughtStepItem({ step }: { step: WorkStep & { type: "thought" } }) {
  const [open, setOpen] = useState(false);
  const durationLabel = formatDuration(step.durationSec);

  return (
    <div className="rounded border border-gold/15 bg-black/20 transition-colors hover:border-gold/30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] font-body text-gold-2/85 hover:text-cream transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-gold/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M9 21h6" />
          </svg>
          <span>Thought for {durationLabel}</span>
        </div>
        <ChevronIcon open={open} className="text-gold/60" />
      </button>

      {open && (
        <div className="border-t border-gold/15 px-3 py-2.5">
          {step.content ? (
            <div className="scroll-gold max-h-60 overflow-y-auto whitespace-pre-wrap font-mono text-[12px] italic leading-relaxed text-[#ded4bf]">
              {step.content}
            </div>
          ) : (
            <p className="font-body text-[12px] italic text-gold/50">
              Internal strategy and reasoning deliberation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Individual Accordion for a Search step */
function SearchStepItem({ step }: { step: WorkStep & { type: "search" } }) {
  const [open, setOpen] = useState(false);
  const count = step.websitesFound;

  return (
    <div className="rounded border border-gold/15 bg-black/20 transition-colors hover:border-gold/30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] font-body text-gold-2/85 hover:text-cream transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-gold/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Found {count} website{count === 1 ? "" : "s"}</span>
        </div>
        <ChevronIcon open={open} className="text-gold/60" />
      </button>

      {open && (
        <div className="space-y-2 border-t border-gold/15 px-3 py-2.5">
          {step.results.length > 0 ? (
            step.results.map((res: SearchResult, idx: number) => {
              let domain = "";
              try {
                domain = new URL(res.url).hostname;
              } catch {
                domain = res.url;
              }

              return (
                <a
                  key={idx}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded border border-gold/20 bg-white/[0.02] p-2.5 transition-all hover:border-gold/50 hover:bg-gold/[0.06]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 font-body text-[13px] font-medium text-cream transition-colors group-hover:text-gold">
                      {res.title || res.url}
                    </span>
                    <svg
                      className="h-3 w-3 shrink-0 text-gold/50 transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </div>
                  {domain && (
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-gold/60">
                      {domain}
                    </span>
                  )}
                  {res.snippet && (
                    <p className="mt-1 line-clamp-3 font-body text-[12px] leading-relaxed text-[#c7bcab]">
                      {res.snippet}
                    </p>
                  )}
                </a>
              );
            })
          ) : (
            <p className="font-body text-[12px] italic text-gold/50">
              Searched query: “{step.query}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Individual Accordion for an Image Gen step */
function ImageStepItem({ step }: { step: WorkStep & { type: "image_gen" } }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-gold/15 bg-black/20 transition-colors hover:border-gold/30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] font-body text-gold-2/85 hover:text-cream transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-gold/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>Generated visual artwork</span>
        </div>
        <ChevronIcon open={open} className="text-gold/60" />
      </button>

      {open && (
        <div className="border-t border-gold/15 px-3 py-2.5">
          <p className="font-body text-[12px] leading-relaxed text-[#ded4bf]">
            Prompt: “{step.prompt}”
          </p>
          {step.imageUrl && (
            <div className="mt-2 overflow-hidden rounded border border-gold/30">
              <img src={step.imageUrl} alt="Generated visual output" className="max-h-48 w-auto rounded object-contain" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Complete Work / Agentic Execution Accordion */
function WorkAccordion({ work }: { work?: WorkData }) {
  const [isMasterOpen, setIsMasterOpen] = useState(false);

  if (!work || work.steps.length === 0) return null;

  // 1. LIVE WORK MODE (while reasoning, searching, or generating)
  if (work.isWorking) {
    return (
      <div className="mb-4 rounded-md border border-gold/25 bg-black/40 p-3 shadow-[0_2px_14px_rgba(0,0,0,0.35)]">
        <div className="space-y-2">
          {work.steps.map((step) => {
            if (step.isLive) {
              return (
                <div key={step.id} className="flex items-center gap-2.5 text-[13px] text-gold-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                  </span>
                  <span className="shimmer-text font-display italic tracking-wide">
                    {step.type === "thought"
                      ? "Thinking…"
                      : step.type === "search"
                        ? `Searching the web…`
                        : "Composing visual representation…"}
                  </span>
                </div>
              );
            }

            if (step.type === "thought") {
              return (
                <div key={step.id} className="flex items-center gap-2 text-[12.5px] font-body text-gold/75">
                  <svg className="h-3.5 w-3.5 text-gold/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                    <path d="M9 21h6" />
                  </svg>
                  <span>Thought for {formatDuration(step.durationSec)}</span>
                </div>
              );
            }

            if (step.type === "search") {
              return (
                <div key={step.id} className="flex items-center gap-2 text-[12.5px] font-body text-gold/75">
                  <svg className="h-3.5 w-3.5 text-gold/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Found {step.websitesFound} website{step.websitesFound === 1 ? "" : "s"}</span>
                </div>
              );
            }

            if (step.type === "image_gen") {
              return (
                <div key={step.id} className="flex items-center gap-2 text-[12.5px] font-body text-gold/75">
                  <svg className="h-3.5 w-3.5 text-gold/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>Generated visual artwork</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  }

  // 2. COMPLETED WORK MODE (Collapsed Master Accordion)
  const totalLabel = formatDuration(work.totalDurationSec);

  return (
    <div className="mb-4 select-none">
      <button
        type="button"
        onClick={() => setIsMasterOpen((prev) => !prev)}
        className="group inline-flex cursor-pointer items-center gap-2 rounded-sm border border-gold/30 bg-gold/[0.05] px-3 py-1 font-display text-[12px] uppercase tracking-[0.16em] text-gold-2/90 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-all hover:border-gold/60 hover:bg-gold/[0.12] hover:text-cream active:scale-95"
        aria-expanded={isMasterOpen}
      >
        <span>Worked for {totalLabel}</span>
        <ChevronIcon open={isMasterOpen} className="text-gold/70 group-hover:text-cream" />
      </button>

      {isMasterOpen && (
        <div className="mt-2.5 ml-1 space-y-2 border-l border-gold/25 pl-3.5">
          {work.steps.map((step) => {
            if (step.type === "thought") {
              if (!step.content.trim() && step.durationSec < 0.6) return null;
              return <ThoughtStepItem key={step.id} step={step} />;
            }
            if (step.type === "search") {
              return <SearchStepItem key={step.id} step={step} />;
            }
            if (step.type === "image_gen") {
              return <ImageStepItem key={step.id} step={step} />;
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

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

  const isWorking = Boolean(m.work?.isWorking);
  const auraState: AuraState = m.streaming
    ? (isWorking ? "thinking" : "answering")
    : "idle";

  return (
    <div ref={isLatest ? rowRef : undefined} className="rise flex items-start gap-4">
      <Aura state={auraState} size={44} className="mt-1 shrink-0" ring={false} />

      <div className="min-w-0 max-w-[82%] flex-1 pt-1.5 font-body">
        {/* Agentic Execution / Work details */}
        {m.work && <WorkAccordion work={m.work} />}

        {/* Answer Content */}
        <RichMarkdown
          text={m.content}
          streaming={m.streaming && !isWorking}
          imageUrl={m.imageUrl}
        />

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

  // Smoothly scroll ONCE to the top of the answer row
  useEffect(() => {
    const latestAssistant = messages.findLast((m) => m.role === "assistant");
    if (latestAssistant && latestAssistant.id !== scrolledAssistantIdRef.current) {
      scrolledAssistantIdRef.current = latestAssistant.id;
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
    </div>
  );
}

