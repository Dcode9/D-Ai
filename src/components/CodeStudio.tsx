import { useState, useEffect, useRef, useMemo, type ChangeEvent } from "react";
import { wrapCodeInDaiSandboxedHtml } from "../lib/designSystemTemplate";
import { cn } from "../utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  initialCode?: string;
  title?: string;
  onSendToChat?: (prompt: string) => void;
};

const DEFAULT_STARTER_CODE = `<div class="dai-card" style="max-width: 540px; margin: 2rem auto; text-align: center;">
  <div class="dai-badge">✦ Sovereign Prototype</div>
  <h1 style="margin: 1rem 0 0.5rem;">Ornate Architecture</h1>
  <p style="margin-bottom: 1.5rem;">
    Experience real-time interactive development within D'Ai's regal design philosophy.
  </p>
  <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
    <button class="dai-btn" onclick="alert('Salutations from D\\'Ai Studio!')">
      Execute
    </button>
    <button class="dai-btn dai-btn-secondary" onclick="document.body.style.background = document.body.style.background === 'rgb(35, 34, 32)' ? '#1c1b1a' : '#232220'">
      Toggle Mood
    </button>
  </div>
</div>`;

export function CodeStudio({ open, onClose, initialCode, title = "Code Studio", onSendToChat }: Props) {
  const [code, setCode] = useState<string>(initialCode || DEFAULT_STARTER_CODE);
  const [activeTab, setActiveTab] = useState<"split" | "editor" | "preview">("split");
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [logs, setLogs] = useState<Array<{ type: "log" | "warn" | "error"; text: string; time: string }>>([]);
  const [showLogs, setShowLogs] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial code when opened
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  // Inject console interceptor into iframe so logs appear in studio
  const sandboxedHtml = useMemo(() => {
    const raw = wrapCodeInDaiSandboxedHtml(code);
    const consoleInterceptor = `
      <script>
        (function() {
          const sendLog = (type, args) => {
            try {
              const msg = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
              window.parent.postMessage({ type: 'dai:studio-log', logType: type, text: msg, time: new Date().toLocaleTimeString() }, '*');
            } catch (_) {}
          };
          const oLog = console.log, oWarn = console.warn, oErr = console.error;
          console.log = function() { sendLog('log', arguments); oLog.apply(console, arguments); };
          console.warn = function() { sendLog('warn', arguments); oWarn.apply(console, arguments); };
          console.error = function() { sendLog('error', arguments); oErr.apply(console, arguments); };
          window.onerror = function(msg, url, line) { sendLog('error', [msg + ' (line ' + line + ')']); };
        })();
      </script>
    `;
    return raw.replace("<head>", `<head>${consoleInterceptor}`);
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

  // Listen for iframe logs
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === "dai:studio-log") {
        setLogs((prev) => [
          ...prev.slice(-40),
          { type: e.data.logType || "log", text: e.data.text, time: e.data.time },
        ]);
      }
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

  if (!open) return null;

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
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "code-studio"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = sandboxedHtml;
    }
  };

  // Upload handler using Groq Vision API or Code file parser
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Text/Code file upload (.html, .js, .css, .json, .ts, etc.)
    if (file.type.startsWith("text/") || /\.(html|htm|js|jsx|ts|tsx|css|json|svg)$/i.test(file.name)) {
      try {
        const text = await file.text();
        setCode(text);
        setLogs((prev) => [
          ...prev,
          { type: "log", text: `Loaded file: ${file.name}`, time: new Date().toLocaleTimeString() },
        ]);
      } catch (err: any) {
        alert("Failed to read code file: " + err.message);
      }
      return;
    }

    // 2. Image upload: Send to Groq Vision for UI recreation
    if (file.type.startsWith("image/")) {
      setIsUploading(true);
      setUploadStatus("Analyzing image with Groq Vision (Qwen 3.6 27B)…");

      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;

          try {
            const visionPrompt = `You are D'Ai Studio. Analyze this user-uploaded mockup, wireframe, or design image.
Generate complete, production-grade, self-contained HTML, CSS, and JavaScript that faithfully implements this design, using D'Ai's regal ornate design philosophy.
Output ONLY the clean HTML document inside a \`\`\`html code block. No unnecessary pleasantries.`;

            const res = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: visionPrompt },
                      { type: "image_url", image_url: { url: dataUrl } },
                    ],
                  },
                ],
                stream: false,
              }),
            });

            if (!res.ok) {
              throw new Error(`Groq Vision API returned HTTP ${res.status}`);
            }

            const data = await res.json();
            const choiceContent =
              data.choices?.[0]?.message?.content ||
              (typeof data === "string" ? data : "");

            // Extract code block
            const codeMatch = choiceContent.match(/```(?:html|htm|xml)?\s*([\s\S]*?)```/i);
            const extractedCode = codeMatch ? codeMatch[1].trim() : choiceContent.trim();

            if (extractedCode) {
              setCode(extractedCode);
              setLogs((prev) => [
                ...prev,
                {
                  type: "log",
                  text: `Groq Vision successfully generated code from ${file.name}`,
                  time: new Date().toLocaleTimeString(),
                },
              ]);
            }

            // Also optionally notify main chat
            if (onSendToChat) {
              onSendToChat(`[UPLOADED_IMAGE: ${dataUrl}]\nRecreated this design in Code Studio.`);
            }
          } catch (apiErr: any) {
            console.error("Groq Vision Upload Error:", apiErr);
            alert("Groq Vision processing failed: " + apiErr.message);
          } finally {
            setIsUploading(false);
            setUploadStatus("");
          }
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        setIsUploading(false);
        setUploadStatus("");
        alert("File reading failed: " + err.message);
      }
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px] transition-opacity duration-300"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[850px] flex-col border-l border-gold/40 bg-[#0e0c10]/98 shadow-[-16px_0_60px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-transform duration-300">
        {/* Ornate Frame rails */}
        <div className="pointer-events-none absolute inset-2 rounded-lg border border-gold/20" />

      {/* Header Bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-gold/25 bg-black/50 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-xl text-gold">✦</span>
          <div>
            <h2 className="font-display text-[22px] tracking-[0.06em] text-cream">
              {title}
            </h2>
            <p className="font-body text-[12px] text-muted">
              Live Sandbox Preview & Full-Freedom Code Editor
            </p>
          </div>
        </div>

        {/* View Switcher: Split | Editor | Preview */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-gold/30 bg-black/40 p-0.5 font-body">
            <button
              type="button"
              onClick={() => setActiveTab("split")}
              className={cn(
                "cursor-pointer rounded px-2.5 py-0.5 font-display text-[12px] uppercase tracking-[0.14em] transition-colors",
                activeTab === "split" ? "bg-gold/20 text-cream font-semibold" : "text-muted hover:text-cream",
              )}
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("editor")}
              className={cn(
                "cursor-pointer rounded px-2.5 py-0.5 font-display text-[12px] uppercase tracking-[0.14em] transition-colors",
                activeTab === "editor" ? "bg-gold/20 text-cream font-semibold" : "text-muted hover:text-cream",
              )}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={cn(
                "cursor-pointer rounded px-2.5 py-0.5 font-display text-[12px] uppercase tracking-[0.14em] transition-colors",
                activeTab === "preview" ? "bg-gold/20 text-cream font-semibold" : "text-muted hover:text-cream",
              )}
            >
              Sandbox
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Code Studio"
            className="cursor-pointer rounded-full p-1 text-gold/60 transition-colors hover:text-cream"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Toolbar: Upload using Groq, Run, Copy, Download, Clear, Logs */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-gold/15 bg-black/30 px-6 py-2">
        <div className="flex items-center gap-2">
          {/* Upload Button (Groq Vision / Code file) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.html,.js,.jsx,.ts,.tsx,.css,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            title="Upload design image (Groq Vision AI) or code file"
            className="flex cursor-pointer items-center gap-1.5 rounded border border-gold/45 bg-gold/15 px-3 py-1 font-display text-[13px] uppercase tracking-[0.12em] text-cream transition-all hover:border-gold hover:bg-gold/25 active:scale-95 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span>{isUploading ? "Analyzing…" : "Upload (Groq)"}</span>
          </button>

          {/* Refresh / Run */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Re-run Sandbox"
            className="flex cursor-pointer items-center gap-1.5 rounded border border-gold/25 bg-black/30 px-2.5 py-1 font-display text-[12.5px] uppercase tracking-[0.12em] text-gold-2 hover:border-gold/50 hover:bg-gold/10 hover:text-cream"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Run</span>
          </button>

          {/* Direct Preview Link in New Tab */}
          {previewBlobUrl && (
            <a
              href={previewBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open previewable website in a new standalone browser tab"
              className="flex items-center gap-1.5 rounded border border-gold/50 bg-gold/20 px-3 py-1 font-display text-[12.5px] uppercase tracking-[0.12em] text-[#fff5dc] transition-all hover:border-gold hover:bg-gold/35 active:scale-95 shadow-[0_0_12px_rgba(201,168,106,0.25)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Preview Link ↗</span>
            </a>
          )}

          {/* Console / Logs toggle */}
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded border px-2 py-1 font-display text-[12px] uppercase tracking-wider transition-colors",
              showLogs
                ? "border-gold bg-gold/20 text-cream"
                : "border-gold/20 text-muted hover:border-gold/40 hover:text-cream",
            )}
          >
            <span className="font-mono text-[10px]">&gt;_</span>
            <span>Logs ({logs.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 font-body">
          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Code"
            className="flex cursor-pointer items-center gap-1 rounded border border-gold/20 px-2.5 py-1 text-[12px] text-gold/80 hover:border-gold/40 hover:bg-gold/10 hover:text-cream"
          >
            {copied ? "Copied!" : "Copy"}
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download .html file"
            className="flex cursor-pointer items-center gap-1 rounded border border-gold/20 px-2.5 py-1 text-[12px] text-gold/80 hover:border-gold/40 hover:bg-gold/10 hover:text-cream"
          >
            Download
          </button>
        </div>
      </div>

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="flex items-center gap-3 border-b border-gold/30 bg-gold/10 px-6 py-2.5 text-gold-2">
          <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
          <span className="font-display italic text-[14px]">{uploadStatus}</span>
        </div>
      )}

      {/* Main Studio Body: Editor & Preview Split or Single */}
      <div className="relative flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Editor Pane */}
        {(activeTab === "split" || activeTab === "editor") && (
          <div
            className={cn(
              "relative flex flex-col border-b border-gold/20 bg-[#121110] md:border-b-0 md:border-r",
              activeTab === "split" ? "h-1/2 w-full md:h-full md:w-1/2" : "h-full w-full",
            )}
          >
            <div className="flex items-center justify-between border-b border-gold/15 bg-black/40 px-4 py-1.5 font-display text-[12px] uppercase tracking-wider text-muted">
              <span>Code Editor</span>
              <span className="font-mono text-[11px] text-gold/60">{code.length} chars</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="scroll-gold h-full w-full resize-none bg-transparent p-4 font-mono text-[13.5px] leading-relaxed text-[#f4edd9] outline-none selection:bg-gold/30"
              placeholder="Paste or write HTML/CSS/JS here…"
            />
          </div>
        )}

        {/* Sandbox Live Preview Pane */}
        {(activeTab === "split" || activeTab === "preview") && (
          <div
            className={cn(
              "relative flex flex-col bg-[#1c1b1a]",
              activeTab === "split" ? "h-1/2 w-full md:h-full md:w-1/2" : "h-full w-full",
            )}
          >
            <div className="flex items-center justify-between border-b border-gold/15 bg-black/40 px-4 py-1.5 font-display text-[12px] uppercase tracking-wider text-muted">
              <span>Live Sandbox Preview</span>
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>
            <div className="relative flex-1">
              <iframe
                ref={iframeRef}
                srcDoc={sandboxedHtml}
                title="D'Ai Code Studio Preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                className="h-full w-full border-0 bg-[#1c1b1a]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Logs Drawer (Expandable) */}
      {showLogs && (
        <div className="relative max-h-48 border-t border-gold/25 bg-black/90 p-3 font-mono text-[12px]">
          <div className="mb-2 flex items-center justify-between border-b border-gold/20 pb-1 text-[11px] uppercase tracking-wider text-gold-2">
            <span>Sandbox Console Logs</span>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-muted hover:text-cream"
            >
              Clear
            </button>
          </div>
          <div className="scroll-gold max-h-32 space-y-1 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="italic text-muted/60">No console outputs yet.</div>
            ) : (
              logs.map((l, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2",
                    l.type === "error" ? "text-rose-400" : l.type === "warn" ? "text-amber-300" : "text-[#dcd0b3]",
                  )}
                >
                  <span className="text-[10px] text-muted">{l.time}</span>
                  <span className="flex-1 break-all">{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </aside>
    </>
  );
}
