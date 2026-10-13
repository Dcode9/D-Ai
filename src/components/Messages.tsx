import { memo, useEffect, useRef, useState, useMemo } from "react";
import { useDecodeAll, useDecodeTail } from "../lib/decode";
import { marked, type Tokens } from "marked";
import type { Message, WorkData, WorkStep, SearchResult } from "../hooks/useChat";
import { Aura, type AuraState } from "./Aura";
import { ArtifactPreview } from "./ArtifactPreview";
import { cn } from "../utils/cn";
import { GenUI, parseGenSpec, wrapBareGenUI } from "./GenUI";
import { processMathAndMarkdown } from "../lib/renderMarkdown";

type Props = {
  messages: Message[];
  state: AuraState;
  onOpenStudio?: (code: string, title?: string) => void;
  onBranch?: (messageId: string) => void;
  onRegenerate?: (prompt: string) => void;
};

/** Short label that glyph-decodes into place the moment it appears. */
function Decoded({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useDecodeAll(ref, text);
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}

/** Streaming thought text: the newest characters decode as they arrive. */
function DecodedTail({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useDecodeTail(ref, true, text, 22, 200);
  return (
    <div ref={ref} className={className}>
      {text}
    </div>
  );
}

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

  if (!step.content || !step.content.trim()) return null;

  return (
    <div className="rounded border border-gold/25 bg-black/40 transition-colors hover:border-gold/45 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] font-display uppercase tracking-wider text-gold-2/90 hover:text-cream transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-gold shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M9 21h6" />
          </svg>
          <span>Thought for {durationLabel}</span>
        </div>
        <ChevronIcon open={open} className="text-gold/60" />
      </button>

      {open && (
        <div className="border-t border-gold/15 bg-black/30 px-3.5 py-3">
          <div className="scroll-gold max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-[12px] italic leading-relaxed text-[#ded4bf]">
            {step.content}
          </div>
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
    <div className="rounded border border-cyan-500/30 bg-black/40 transition-colors hover:border-cyan-400/50 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] font-display uppercase tracking-wider text-cyan-200/90 hover:text-cream transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Found {count} web archive{count === 1 ? "" : "s"}</span>
        </div>
        <ChevronIcon open={open} className="text-cyan-400/70" />
      </button>

      {open && (
        <div className="space-y-2 border-t border-cyan-500/20 bg-black/30 px-3.5 py-3">
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
                  className="group block rounded border border-cyan-500/25 bg-black/40 p-2.5 transition-all hover:border-cyan-400/60 hover:bg-cyan-950/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 font-body text-[13px] font-medium text-cream transition-colors group-hover:text-cyan-300">
                      {res.title || res.url}
                    </span>
                    <svg
                      className="h-3 w-3 shrink-0 text-cyan-400/60 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300"
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
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-cyan-400/70">
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
            <p className="font-body text-[12px] italic text-cyan-300/60">
              Searched query: “{step.query}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Real-time progress for image generation: elapsed time, honest stages, and a bar that eases toward done. */
function LiveImageProgress({ prompt }: { prompt: string }) {
  const hd = typeof localStorage === "undefined" || localStorage.getItem("dai-hd") !== "0";
  const expect = hd ? 65 : 10;
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setT((Date.now() - t0) / 1000), 250);
    return () => window.clearInterval(id);
  }, []);
  const pct = Math.min(94, Math.round(100 * (1 - Math.exp((-2.2 * t) / expect))));
  const stage = !hd ? "Painting…" : t < 8 ? "Sending your prompt to GPT Image 2…" : t < 40 ? "Painting in HD…" : t < 70 ? "Adding the final detail…" : "Almost there, HD is taking a little longer…";
  return (
    <div className="text-[13px] text-purple-200">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display italic tracking-wide text-purple-300">{stage}</span>
        <span className="font-mono text-[11px] text-purple-300/70 tabular-nums">{Math.floor(t)}s{hd ? " / ~60s" : ""}</span>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden rounded-full border border-gold/30 bg-black/60">
        <div className="h-full rounded-full bg-gradient-to-r from-gold/60 to-[#fff3d6] transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 truncate font-body text-[11.5px] italic text-purple-400/70">“{prompt}”</div>
      {hd && <div className="mt-0.5 font-body text-[11px] text-gold/50">HD takes about a minute. Tap the HD pill for instant fast mode.</div>}
    </div>
  );
}

/** Individual Accordion for an Image Gen step */
function ImageStepItem({ step }: { step: WorkStep & { type: "image_gen" } }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-purple-500/30 bg-black/40 transition-colors hover:border-purple-400/50 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] font-display uppercase tracking-wider text-purple-200/90 hover:text-cream transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>Generated visual artwork</span>
        </div>
        <ChevronIcon open={open} className="text-purple-400/70" />
      </button>

      {open && (
        <div className="border-t border-purple-500/20 bg-black/30 px-3.5 py-3">
          <p className="font-body text-[12px] leading-relaxed text-[#ded4bf]">
            Prompt: “{step.prompt}”
          </p>
          {step.imageUrl && (
            <div className="mt-2 overflow-hidden rounded border border-purple-500/40">
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

  const visibleSteps = useMemo(() => {
    return (work?.steps || []).filter((s) => {
      if (s.type === "thought") return Boolean(s.content && s.content.trim());
      if (s.type === "search") return true;
      if (s.type === "image_gen") return true;
      return false;
    });
  }, [work?.steps]);

  if (!work) return null;
  if (!work.isWorking && visibleSteps.length === 0) return null;

  // 1. LIVE WORK MODE (Distinct animations for each action)
  if (work.isWorking) {
    return (
      <div className="step-rail mb-4 space-y-2.5">
        {work.steps.map((step) => {
          // Finished steps stay visible as compact, expandable rows (like a timeline)
          if (!step.isLive && step.type === "thought" && step.content && step.content.trim()) {
            return <div key={step.id} className="step-node decode-in"><ThoughtStepItem step={step} /></div>;
          }
          if (!step.isLive && step.type === "search") {
            return <div key={step.id} className="step-node decode-in"><SearchStepItem step={step} /></div>;
          }
          if (!step.isLive && step.type === "image_gen") {
            return <div key={step.id} className="step-node decode-in"><ImageStepItem step={step} /></div>;
          }
          // Live Thought Stage
          if (step.type === "thought" && step.isLive) {
            return (
              <div
                key={step.id}
                className="step-node decode-in animate-thought-stage rounded-md border border-gold/40 bg-black/50 p-3 shadow-[0_4px_20px_rgba(201,168,106,0.15)]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-gold/20 pb-2 mb-2">
                  <div className="flex items-center gap-2 text-[13px] text-gold-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                    </span>
                    <Decoded className="shimmer-text font-display italic tracking-wide" text="Deliberating architectural reasoning…" />
                  </div>
                  <span className="font-mono text-[11px] text-gold/70">
                    {formatDuration(step.durationSec)}
                  </span>
                </div>

                {step.content && (
                  <div className="border-l border-gold/30 pl-2.5">
                    <DecodedTail
                      className="scroll-gold max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[11.5px] italic leading-relaxed text-[#ded4bf]/90"
                      text={step.content}
                    />
                  </div>
                )}
              </div>
            );
          }

          // Live Web Search Stage
          if (step.type === "search" && step.isLive) {
            return (
              <div
                key={step.id}
                className="step-node decode-in rounded-md border border-cyan-500/40 bg-black/50 p-3 shadow-[0_4px_20px_rgba(6,182,212,0.18)]"
              >
                <div className="flex items-center gap-3 text-[13px] text-cyan-200">
                  <div className="relative flex h-4 w-4 items-center justify-center">
                    <div className="absolute h-full w-full rounded-full border border-cyan-400 radar-ping" />
                    <svg className="h-4 w-4 text-cyan-400 radar-sweep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="12" x2="12" y2="2" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <Decoded className="font-display italic tracking-wide text-cyan-300" text="Scanning live web archives…" />
                    <Decoded className="font-mono text-[11px] text-cyan-400/70 truncate max-w-[340px]" text={`Query: “${step.query}”`} />
                  </div>
                </div>
              </div>
            );
          }

          // Live Image Synthesis Stage
          if (step.type === "image_gen" && step.isLive) {
            return (
              <div
                key={step.id}
                className="step-node decode-in animate-aperture-bloom rounded-md border border-purple-500/40 bg-black/50 p-3 shadow-[0_4px_20px_rgba(168,85,247,0.2)]"
              >
                <LiveImageProgress prompt={step.prompt} />
              </div>
            );
          }

          return null;
        })}
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
        className="group inline-flex cursor-pointer items-center gap-2 rounded-sm border border-gold/30 bg-gold/[0.05] px-3.5 py-1.5 font-display text-[12px] uppercase tracking-[0.16em] text-gold-2/90 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-all hover:border-gold/60 hover:bg-gold/[0.12] hover:text-cream active:scale-95"
        aria-expanded={isMasterOpen}
      >
        <span>
          Thought for {totalLabel}
          {(() => {
            const n = visibleSteps.filter((x) => x.type === "search").length;
            return n ? ` · ${n} ${n === 1 ? "search" : "searches"}` : "";
          })()}
        </span>
        <ChevronIcon open={isMasterOpen} className="text-gold/70 group-hover:text-cream" />
      </button>

      {isMasterOpen && (
        <div className="step-rail mt-2.5 ml-1 space-y-2">
          {visibleSteps.map((step) => {
            if (step.type === "thought") {
              return <div key={step.id} className="step-node"><ThoughtStepItem step={step} /></div>;
            }
            if (step.type === "search") {
              return <div key={step.id} className="step-node"><SearchStepItem step={step} /></div>;
            }
            if (step.type === "image_gen") {
              return <div key={step.id} className="step-node"><ImageStepItem step={step} /></div>;
            }
            if (step.type === "memory") {
              return (
                <div key={step.id} className="flex items-center gap-2 py-1 font-body text-[12.5px] text-gold/85">
                  <span className="text-xs">🧠</span>
                  <span>{step.action === "add" ? `Stored memory: "${step.fact}"` : "Recalled personal memory context"}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

/** Custom CodeBlock component with language badge, copy action, and Open in Studio */
function CodeBlock({
  lang,
  code,
  onOpenStudio,
}: {
  lang: string;
  code: string;
  onOpenStudio?: (code: string, title?: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWebCode = /^(html|htm|jsx?|tsx?|css|svg|vue|web)$/i.test(lang);

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
      <div className="flex items-center justify-between bg-white/[0.05] px-3.5 py-1.5">
        <span className="font-display text-[13px] uppercase tracking-[0.2em] text-gold-2/80">
          {lang || "code"}
        </span>
        <div className="flex items-center gap-2">
          {isWebCode && onOpenStudio && (
            <button
              type="button"
              onClick={() => onOpenStudio(code, `${lang.toUpperCase()} Snippet`)}
              className="flex cursor-pointer items-center gap-1 rounded border border-gold/30 bg-gold/10 px-2 py-0.5 font-display text-[11.5px] uppercase tracking-wider text-cream transition-all hover:border-gold hover:bg-gold/25 active:scale-95"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Studio</span>
            </button>
          )}

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
      </div>
      <pre className="scroll-gold overflow-x-auto p-4 font-mono text-[14px] leading-relaxed text-[#f0e6d2]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const htmlCache = new Map<string, string>();
/** Markdown to HTML, remembered per segment so a streaming reply only re-parses the part that changed. */
function cachedHtml(part: string): string {
  const hit = htmlCache.get(part);
  if (hit !== undefined) return hit;
  const html = cachedHtml(part);
  if (htmlCache.size > 300) htmlCache.delete(htmlCache.keys().next().value as string);
  htmlCache.set(part, html);
  return html;
}

/** Split prose at blank lines into paragraphs, but keep lists, tables, quotes, indents and $$ math together. */
function splitProseBlocks(part: string): string[] {
  const raw = part.split(/\n{2,}/);
  const out: string[] = [];
  for (const r of raw) {
    if (!r.trim()) continue;
    const prev = out[out.length - 1];
    const sticky = /^\s*([-*+]\s|\d+[.)]\s|>|\||\s{2,}|\t)/.test(r);
    const prevOpen = prev !== undefined && ((prev.match(/\$\$/g) || []).length % 2 === 1 || /^\s*([-*+]\s|\d+[.)]\s|\|)/.test(prev.split("\n").pop() || ""));
    if (prev !== undefined && (sticky || prevOpen)) out[out.length - 1] = prev + "\n\n" + r;
    else out.push(r);
  }
  return out.length ? out : [part];
}

/** Segmented Markdown Renderer combining marked tokens with custom CodeBlock components, KaTeX math, and Artifact Previews */
function RichMarkdown({
  text,
  streaming,
  imageUrl,
  onOpenStudio,
}: {
  text: string;
  streaming?: boolean;
  imageUrl?: string;
  onOpenStudio?: (code: string, title?: string) => void;
}) {
  const renderedContent = useMemo(() => {
    if (!text.trim()) return null;

    try {
      // Split on fenced code blocks to isolate executable code from prose/math
      let processedText = wrapBareGenUI(text);
      // Handle streaming: if code block is currently being streamed, close it so it renders live
      const backtickCount = (processedText.match(/```/g) || []).length;
      if (backtickCount % 2 === 1) {
        processedText = processedText + "\n```";
      }

      const parts = processedText.split(/(```[\s\S]*?```)/g);
      return parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const firstLineEnd = part.indexOf("\n");
          const rawLang = part.slice(3, firstLineEnd > 0 ? firstLineEnd : 3).trim().toLowerCase();
          const lang = rawLang.split(/\s+/)[0] || "";
          const code = firstLineEnd > 0 ? part.slice(firstLineEnd + 1, -3) : "";

          if (lang === "dai-ui") {
            const spec = parseGenSpec(code.trim());
            return spec ? <GenUI key={`ui-${idx}`} spec={spec} /> : (
              <div key={`ui-${idx}`} className="my-4 rounded-md border border-gold/25 bg-black/40 px-4 py-3 font-display italic text-gold/70 shimmer-text">Composing…</div>
            );
          }

          // Check if this should render as an interactive direct output artifact
          const isExplicitArtifact = lang === "dai-artifact" || lang === "artifact";
          const hasMarkup =
            /<(!doctype|html|head|body|div|svg|button|main|header|section|style|script|form|canvas|table|p|span|nav|h[1-6]|input|ul|li|footer|article)[\s>]/i.test(code);
          const isWebLang = /^(html?|svg|xml|jsx?|tsx?|vue|web)$/i.test(lang) || !lang;
          const isWebArtifact = (isWebLang && hasMarkup) || (lang.startsWith("html") && code.includes("<"));

          if (isExplicitArtifact || isWebArtifact) {
            return (
              <ArtifactPreview
                key={`artifact-${idx}`}
                code={code}
                lang={lang || "html"}
                title={isExplicitArtifact ? "Interactive Output" : "Web Prototype"}
                onOpenStudio={onOpenStudio}
              />
            );
          }

          return (
            <CodeBlock
              key={`code-${idx}`}
              lang={lang || "code"}
              code={code}
              onOpenStudio={onOpenStudio}
            />
          );
        }
        if (!part.trim()) return null;
        // Each paragraph is its own stable node: finished ones are never touched again, and a new one fades in once.
        const blocks = splitProseBlocks(part);
        return blocks.map((b, bi) => (
          <div
            key={`prose-${idx}-${bi}`}
            className={`dai-prose text-[16px] leading-[1.75] text-[#ded4bf]${streaming ? " dai-reveal" : ""}`}
            dangerouslySetInnerHTML={{ __html: processMathAndMarkdown(b) }}
          />
        ));
      });
    } catch {
      return (
        <div className="dai-prose whitespace-pre-wrap">
          {text}
        </div>
      );
    }
  }, [text, onOpenStudio, streaming]);

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

const IC = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function ActionBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        try { navigator.vibrate?.(8); } catch {}
        onClick();
      }}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-cream/45 transition-all hover:bg-white/[.07] hover:text-cream active:scale-90",
        active && "text-gold-2",
      )}
    >
      {children}
    </button>
  );
}

const CheckIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...IC}><path d="M20 6L9 17l-5-5" /></svg>
);
const CopyIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...IC}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);

function UserBubbleInner({ m, onBranch }: { m: Message; onBranch?: (messageId: string) => void }) {
  const [copied, setCopied] = useState(false);
  const text = m.content.replace(/\[UPLOADED_IMAGE:[^\]]*\]\n?/g, "").trim();
  return (
    <div data-role="user" className="rise group flex flex-col items-end gap-1">
      <div className="max-w-[88%] rounded-[22px] rounded-br-md border border-gold/20 bg-gradient-to-br from-[#2d2820] to-[#221f1a] px-4 py-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.25)]">
        {m.mode && (
          <div className="mb-0.5 font-body text-[10.5px] uppercase tracking-[0.2em] text-gold/70">{m.mode}</div>
        )}
        <p className="whitespace-pre-wrap break-words font-body text-[16px] leading-[1.6] text-cream">{text || m.content}</p>
      </div>
      <div className="flex items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <ActionBtn
          label={copied ? "Copied" : "Copy"}
          onClick={() => {
            navigator.clipboard?.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? CheckIcon : CopyIcon}
        </ActionBtn>
        <ActionBtn label="Edit" onClick={() => window.dispatchEvent(new CustomEvent("dai:edit", { detail: { text } }))}>
          <svg width="17" height="17" viewBox="0 0 24 24" {...IC}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </ActionBtn>
        {onBranch && (
          <ActionBtn label="Branch from here" onClick={() => onBranch(m.id)}>
            <svg width="17" height="17" viewBox="0 0 24 24" {...IC}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10" /><path d="M18 11c0 4-6 3-12 6" /></svg>
          </ActionBtn>
        )}
      </div>
    </div>
  );
}

function AssistantRowInner({
  m,
  isLatest,
  rowRef,
  onBranch,
  onOpenStudio,
  onRegenerate,
  prompt,
}: {
  m: Message;
  isLatest: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onBranch?: (messageId: string) => void;
  onOpenStudio?: (code: string, title?: string) => void;
  onRegenerate?: (prompt: string) => void;
  prompt?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fb, setFb] = useState<string>(() => {
    try { return localStorage.getItem(`dai-fb:${m.id}`) || ""; } catch { return ""; }
  });
  const rate = (v: string) => {
    const next = fb === v ? "" : v;
    setFb(next);
    try { next ? localStorage.setItem(`dai-fb:${m.id}`, next) : localStorage.removeItem(`dai-fb:${m.id}`); } catch {}
  };

  const copyAll = () => {
    navigator.clipboard?.writeText(m.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: m.content });
      else { await navigator.clipboard?.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  };

  const isWorking = Boolean(m.work?.isWorking);
  const answerRef = useRef<HTMLDivElement | null>(null);
  const wasStreaming = useRef(false);
  if (m.streaming) wasStreaming.current = true;

  return (
    <div ref={isLatest ? rowRef : undefined} className="rise min-w-0 font-body">
      {/* Agentic Execution / Work details */}
      {m.work && <WorkAccordion work={m.work} />}

      {/* Answer Content */}
      <div ref={answerRef} className={cn("dai-shell", m.streaming ? "is-streaming" : wasStreaming.current && "is-settled")}>
        <RichMarkdown
          text={m.content}
          streaming={m.streaming && !isWorking}
          imageUrl={m.imageUrl}
          onOpenStudio={onOpenStudio}
        />
      </div>

      {/* Action row on completed responses */}
      {!m.streaming && m.content && (
        <div className="-ml-2 mt-1 flex flex-wrap items-center">
          <ActionBtn label={copied ? "Copied" : "Copy"} onClick={copyAll}>{copied ? CheckIcon : CopyIcon}</ActionBtn>
          <ActionBtn label="Good response" active={fb === "up"} onClick={() => rate("up")}>
            <svg width="17" height="17" viewBox="0 0 24 24" {...IC} fill={fb === "up" ? "currentColor" : "none"}><path d="M7 10v11H3V10Z" /><path d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7H7" /></svg>
          </ActionBtn>
          <ActionBtn label="Bad response" active={fb === "down"} onClick={() => rate("down")}>
            <svg width="17" height="17" viewBox="0 0 24 24" {...IC} fill={fb === "down" ? "currentColor" : "none"}><path d="M17 14V3h4v11Z" /><path d="M17 14l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.9 3H17" /></svg>
          </ActionBtn>
          {prompt && onRegenerate && (
            <ActionBtn label="Regenerate" onClick={() => onRegenerate(prompt)}>
              <svg width="17" height="17" viewBox="0 0 24 24" {...IC}><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8" /><path d="M21 3v5h-5" /></svg>
            </ActionBtn>
          )}
          <ActionBtn label="Share" onClick={share}>
            <svg width="17" height="17" viewBox="0 0 24 24" {...IC}><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
          </ActionBtn>
          {onBranch && (
            <ActionBtn label="Branch" onClick={() => onBranch(m.id)}>
              <svg width="17" height="17" viewBox="0 0 24 24" {...IC}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10" /><path d="M18 11c0 4-6 3-12 6" /></svg>
            </ActionBtn>
          )}
        </div>
      )}
    </div>
  );
}

const UserBubble = memo(UserBubbleInner, (a, b) => a.m === b.m && a.onBranch === b.onBranch);
const AssistantRow = memo(
  AssistantRowInner,
  (a, b) => a.m === b.m && a.isLatest === b.isLatest && a.onBranch === b.onBranch && a.onOpenStudio === b.onOpenStudio && a.prompt === b.prompt && a.onRegenerate === b.onRegenerate,
);

export function Messages({ messages, state, onBranch, onOpenStudio, onRegenerate }: Props) {
  const latestRowRef = useRef<HTMLDivElement | null>(null);
  const scrolledAssistantIdRef = useRef<string | null>(null);

  // Smoothly scroll ONCE to the top of the answer row
  useEffect(() => {
    const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (latestAssistant && latestAssistant.id !== scrolledAssistantIdRef.current) {
      scrolledAssistantIdRef.current = latestAssistant.id;
      if (latestRowRef.current) {
        // Land on the question that led to this answer so it is never hidden above the fold.
        const users = latestRowRef.current.parentElement?.querySelectorAll('[data-role="user"]');
        const target = (users && users.length ? users[users.length - 1] : latestRowRef.current) as HTMLElement;
        target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      }
    }
  }, [messages]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="mx-auto flex w-full max-w-[768px] flex-col gap-6 px-4 pb-8 pt-4 sm:px-5 md:gap-7">
      {messages.map((m, mi) =>
        m.role === "user" ? (
          <UserBubble key={m.id} m={m} onBranch={onBranch} />
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
            onBranch={onBranch}
            onOpenStudio={onOpenStudio}
            onRegenerate={onRegenerate}
            prompt={[...messages.slice(0, mi)].reverse().find((x) => x.role === "user")?.content.replace(/\[UPLOADED_IMAGE:[^\]]*\]\n?/g, "").trim()}
          />
        ),
      )}
    </div>
  );
}
