import { useState, useEffect, useMemo, useRef } from "react";
import { wrapCodeInDaiSandboxedHtml } from "../lib/designSystemTemplate";
import { cn } from "../utils/cn";

type Props = {
  code: string;
  lang?: string;
  title?: string;
  onOpenStudio?: (code: string, title?: string) => void;
};

export function ArtifactPreview({ code, lang = "html", title = "Interactive Preview", onOpenStudio }: Props) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sandboxedHtml = useMemo(() => {
    return wrapCodeInDaiSandboxedHtml(code);
  }, [code]);

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>("");

  useEffect(() => {
    if (!sandboxedHtml) {
      setPreviewBlobUrl("");
      return;
    }
    const blob = new Blob([sandboxedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setPreviewBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [sandboxedHtml]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sandboxedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "artifact"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = sandboxedHtml;
    }
  };

  return (
    <div
      className={cn(
        "group relative my-4 flex w-full max-w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14120e] shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
        isFullscreen && "fixed inset-4 z-50 my-0 border-gold bg-[#151413]/98 shadow-[0_0_80px_rgba(0,0,0,0.95)]",
      )}
    >

      {/* Ornate Header Toolbar */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-gold/25 bg-black/50 px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-gold text-sm">✦</span>
          <span className="font-display text-[17px] font-medium tracking-[0.04em] text-cream">
            {title}
          </span>
          <span className="rounded border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-gold-2">
            {lang || "preview"}
          </span>
        </div>

        <div className="flex items-center gap-2 font-body">
          {/* Segmented View Switcher: Output | Code */}
          <div className="flex items-center rounded border border-gold/30 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={cn(
                "cursor-pointer rounded px-2.5 py-0.5 font-display text-[12px] uppercase tracking-[0.14em] transition-colors",
                activeTab === "preview"
                  ? "bg-gold/25 text-cream font-semibold shadow-inner"
                  : "text-muted hover:text-cream",
              )}
            >
              Output
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("code")}
              className={cn(
                "cursor-pointer rounded px-2.5 py-0.5 font-display text-[12px] uppercase tracking-[0.14em] transition-colors",
                activeTab === "code"
                  ? "bg-gold/25 text-cream font-semibold shadow-inner"
                  : "text-muted hover:text-cream",
              )}
            >
              Code
            </button>
          </div>

          {/* Reload Output */}
          {activeTab === "preview" && (
            <button
              type="button"
              onClick={handleReload}
              title="Refresh prototype output"
              className="cursor-pointer rounded border border-gold/20 bg-black/30 p-1 text-gold/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-cream active:scale-95"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          )}

          {/* Standalone Live Preview Link */}
          {previewBlobUrl && (
            <a
              href={previewBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open previewable website in a dedicated browser tab"
              className="flex items-center gap-1.5 rounded-sm border border-gold/55 bg-gold/20 px-2.5 py-1 font-display text-[11.5px] uppercase tracking-[0.12em] text-[#fff6e0] transition-all hover:border-gold hover:bg-gold/35 active:scale-95 shadow-[0_0_10px_rgba(201,168,106,0.25)]"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Preview Link ↗</span>
            </a>
          )}

          {/* Open in Code Studio */}
          {onOpenStudio && (
            <button
              type="button"
              onClick={() => onOpenStudio(code, title)}
              title="Open in Code Studio Sidebar"
              className="flex cursor-pointer items-center gap-1 rounded-sm border border-gold/40 bg-gold/10 px-2.5 py-1 font-display text-[11.5px] uppercase tracking-[0.12em] text-cream transition-all hover:border-gold hover:bg-gold/25 active:scale-95"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Studio</span>
            </button>
          )}

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            className="cursor-pointer rounded border border-gold/20 bg-black/30 p-1 text-gold/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-cream active:scale-95"
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>

          {/* Download HTML */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download standalone HTML file"
            className="cursor-pointer rounded border border-gold/20 bg-black/30 p-1 text-gold/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-cream active:scale-95"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="cursor-pointer rounded border border-gold/20 bg-black/30 p-1 text-gold/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-cream active:scale-95"
          >
            {isFullscreen ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className={cn("relative w-full bg-[#121110]", isFullscreen ? "min-h-0 flex-1" : "h-[min(72vh,640px)] min-h-[320px]")}>
        {/* Direct Output (Iframe Preview) */}
        <div
          className={cn(
            "h-full w-full transition-opacity duration-200",
            activeTab === "preview" ? "opacity-100" : "pointer-events-none hidden opacity-0",
          )}
        >
          <iframe
            ref={iframeRef}
            srcDoc={sandboxedHtml}
            title={title}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            className="block h-full w-full max-w-full border-0 bg-white"
          />
        </div>

        {/* Source Code View */}
        {activeTab === "code" && (
          <div className="scroll-gold h-full w-full overflow-auto p-4 font-mono text-[13px] leading-relaxed text-[#f0e6d2]">
            <pre className="whitespace-pre-wrap">
              <code>{code}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Ornate Website Link Footer Banner */}
      <div className="relative z-20 flex items-center justify-between border-t border-gold/25 bg-black/70 px-5 py-2 font-body text-[12.5px]">
        <div className="flex items-center gap-2 text-gold/85">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-display tracking-wide">Live Previewable Website</span>
        </div>
        {previewBlobUrl && (
          <a
            href={previewBlobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-body text-[12.5px] text-gold-2 hover:text-[#fff6e0] underline transition-colors"
          >
            <span>Open preview website in full browser tab</span>
            <span className="text-[11px]">↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
