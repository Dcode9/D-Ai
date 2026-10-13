import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Ambient } from "./components/Ambient";
import { ChatInput } from "./components/ChatInput";
import { Header } from "./components/Header";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { AppsDrawer, type AppId } from "./components/AppsDrawer";
import { WikiDrawer, wikiTitleFromHref } from "./components/WikiDrawer";
import { Messages } from "./components/Messages";
import { PromptSuggestions } from "./components/PromptSuggestions";
const AccountModal = lazy(() => import("./components/AccountModal").then((m) => ({ default: m.AccountModal })));
const MemoryModal = lazy(() => import("./components/MemoryModal").then((m) => ({ default: m.MemoryModal })));
const CodeStudio = lazy(() => import("./components/CodeStudio").then((m) => ({ default: m.CodeStudio })));
import { SvgDefs } from "./components/SvgDefs";
import { useChat } from "./hooks/useChat";
import { useSize } from "./hooks/useSize";
import { getMemory } from "./lib/memory";
import { getUser, onAuthStateChange } from "./lib/supabase";
import { cn } from "./utils/cn";

export default function App() {
  const chat = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 260);
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [appLaunch, setAppLaunch] = useState<{ app: AppId; query?: string; play?: boolean; n: number } | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail as { app: AppId; query?: string; play?: boolean };
      if (!d?.app) return;
      setAppLaunch({ app: d.app, query: d.query, play: d.play, n: Date.now() });
      setAppsOpen(true);
    };
    window.addEventListener("dai:open-app", onOpen);
    return () => window.removeEventListener("dai:open-app", onOpen);
  }, []);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiReq, setWikiReq] = useState<{ title: string; n: number } | null>(null);
  useEffect(() => {
    const onWiki = (e: Event) => {
      const t = (e as CustomEvent).detail?.title as string | undefined;
      if (!t) return;
      setWikiReq({ title: t, n: Date.now() });
      setWikiOpen(true);
    };
    // Wikipedia links inside answers open the sidebar page instead of leaving the chat
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.closest("aside")) return;
      const t = wikiTitleFromHref(a.href);
      if (!t) return;
      e.preventDefault();
      onWiki(new CustomEvent("x", { detail: { title: t } }));
    };
    window.addEventListener("dai:open-wiki", onWiki);
    document.addEventListener("click", onClick);
    return () => { window.removeEventListener("dai:open-wiki", onWiki); document.removeEventListener("click", onClick); };
  }, []);
  const [accountOpen, setAccountOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [codeStudioOpen, setCodeStudioOpen] = useState(false);
  const [studioCode, setStudioCode] = useState<string>("");
  const [studioTitle, setStudioTitle] = useState<string>("Code Studio");
  const [user, setUser] = useState<User | null>(null);
  const [memoryCount, setMemoryCount] = useState<number>(() => getMemory().length);

  const empty = chat.messages.length === 0 && chat.state === "idle";
  const busy = chat.state !== "idle";

  // Auth state tracking
  useEffect(() => {
    getUser().then(setUser);
    const sub = onAuthStateChange((u) => setUser(u));
    return () => sub.unsubscribe();
  }, []);

  // Memory follows the account: pull + merge once signed in
  useEffect(() => {
    if (user) void import("./lib/memorySync").then((m) => m.pullMemory());
  }, [user]);

  // Memory count listener
  useEffect(() => {
    const updateCount = () => setMemoryCount(getMemory().length);
    window.addEventListener("dai:memory-updated", updateCount as EventListener);
    return () => window.removeEventListener("dai:memory-updated", updateCount as EventListener);
  }, []);

  // Global keyboard shortcuts (Ctrl+K: New Chat, Escape: Close Modals, Alt+S: Code Studio)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        chat.newChat();
      } else if (
        (e.altKey && e.key.toLowerCase() === "s") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s")
      ) {
        e.preventDefault();
        setCodeStudioOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setHistoryOpen(false);
        setAccountOpen(false);
        setMemoryOpen(false);
        setCodeStudioOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chat]);

  const handleOpenStudio = (codeToOpen?: string, customTitle?: string) => {
    if (codeToOpen) {
      setStudioCode(codeToOpen);
    }
    if (customTitle) {
      setStudioTitle(customTitle);
    }
    setCodeStudioOpen(true);
  };

  return (
    <div className="relative flex h-full flex-col bg-ink text-cream" style={{ overflow: "clip" }}>
      <SvgDefs />
      <Ambient state={chat.state} visible={empty} />

      <Header
        onHistory={() => setHistoryOpen(true)}
        onNewChat={chat.newChat}
        onMemory={() => setMemoryOpen(true)}
        onAccount={() => setAccountOpen(true)}
        onStudio={() => setCodeStudioOpen((prev) => !prev)}
        onApps={() => setAppsOpen((p) => !p)}
        appsOpen={appsOpen}
        historyOpen={historyOpen}
        studioOpen={codeStudioOpen}
        memoryCount={memoryCount}
        user={user}
      />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Branch Breadcrumb Navigation Bar (when viewing a branch) */}
        {chat.breadcrumbs.length > 1 && (
          <div className="mx-auto mb-2 flex max-w-[880px] items-center justify-between rounded border border-gold/25 bg-black/40 px-3.5 py-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto text-[12.5px] font-body">
              <span className="font-mono text-[11px] text-gold/70 shrink-0">⑂ Lineage:</span>
              {chat.breadcrumbs.map((crumb, idx) => {
                const isCurrent = idx === chat.breadcrumbs.length - 1;
                return (
                  <div key={crumb.id} className="flex items-center gap-1.5 shrink-0">
                    {idx > 0 && <span className="text-gold/40">›</span>}
                    <button
                      type="button"
                      onClick={() => !isCurrent && chat.openConversation(crumb.id)}
                      className={cn(
                        "rounded px-1.5 py-0.5 transition-colors cursor-pointer",
                        isCurrent
                          ? "font-semibold text-gold bg-gold/15"
                          : "text-cream/70 hover:text-cream hover:bg-white/[.04]",
                      )}
                    >
                      {crumb.title}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Sibling branch switcher */}
            {chat.siblingBranches.length > 1 && (
              <div className="flex items-center gap-1 text-[11px] shrink-0 font-body text-gold/60">
                <span>Branch:</span>
                <select
                  value={chat.activeId || ""}
                  onChange={(e) => chat.openConversation(e.target.value)}
                  className="rounded border border-gold/30 bg-ink px-1.5 py-0.5 text-cream outline-none text-[11.5px] cursor-pointer"
                >
                  {chat.siblingBranches.map((sib) => (
                    <option key={sib.id} value={sib.id}>
                      {sib.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Chat area: clean full-width scroller with a centered column, composer pinned below */}
        <div className="relative min-h-0 flex-1">
          {chat.isLoadingChat && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
              <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-ink px-4 py-2 text-gold shadow-lg">
                <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
                <span className="font-body text-[14px]">Loading chat…</span>
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className={cn("scroll-gold absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain", empty && "flex items-center justify-center")}
          >
            {empty ? (
              <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-6 px-5 pb-10 text-center">
                <div className="rise">
                  <h1 className="font-display text-[30px] leading-tight tracking-wide text-cream sm:text-[38px]">What shall we make?</h1>
                  <p className="mt-2 font-display text-[16px] italic tracking-wide text-muted">The sovereign flame of ornate intelligence.</p>
                </div>
                <PromptSuggestions
                  conversations={chat.conversations}
                  onSelectPrompt={(prompt) => chat.send(prompt)}
                />
              </div>
            ) : (
              <Messages
                messages={chat.messages}
                state={chat.state}
                onBranch={(msgId) => chat.createBranch(chat.activeId || undefined, msgId)}
                onOpenStudio={handleOpenStudio}
                onRegenerate={(prompt) => chat.send(prompt)}
              />
            )}
          </div>

          {showJump && !empty && (
            <button
              type="button"
              onClick={() => { try { navigator.vibrate?.(8); } catch {} scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }}
              aria-label="Scroll to bottom"
              className="rise absolute bottom-3 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-gold/40 bg-[#1d1b17]/95 text-cream shadow-[0_4px_18px_rgba(0,0,0,0.5)] transition-transform active:scale-90"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></svg>
            </button>
          )}
        </div>

        {/* Composer */}
        <div className="relative z-30 shrink-0 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-1.5 sm:px-5">
          <ChatInput
            onSend={chat.send}
            onStop={chat.stop}
            busy={busy}
            mode={chat.mode}
            onMode={chat.setMode}
            onOpenStudio={() => handleOpenStudio()}
          />
        </div>
      </main>

      {/* Saved Chats History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={chat.conversations}
        activeId={chat.activeId}
        onOpen={chat.openConversation}
        onDelete={chat.deleteConversation}
        onNewChat={chat.newChat}
      />

      <WikiDrawer open={wikiOpen} onClose={() => setWikiOpen(false)} request={wikiReq} />
      <AppsDrawer open={appsOpen} onClose={() => setAppsOpen(false)} initialApp={appLaunch} />

      {/* Full Sidebar Code Studio */}
      <Suspense fallback={null}>
<CodeStudio
        open={codeStudioOpen}
        onClose={() => setCodeStudioOpen(false)}
        initialCode={studioCode}
        title={studioTitle}
        onSendToChat={chat.send}
      />

      {/* Google Sign-in & Account Modal */}
      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        savedChatsCount={chat.conversations.length}
        memoryFactsCount={memoryCount}
      />

      {/* Personal Memory Modal */}
      <MemoryModal
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
      />
</Suspense>
    </div>
  );
}
