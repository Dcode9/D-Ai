import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Ambient } from "./components/Ambient";
import { ChatInput } from "./components/ChatInput";
import { Header } from "./components/Header";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { Messages } from "./components/Messages";
import { PromptSuggestions } from "./components/PromptSuggestions";
import { AccountModal } from "./components/AccountModal";
import { MemoryModal } from "./components/MemoryModal";
import { SvgDefs } from "./components/SvgDefs";
import { PanelFrame } from "./components/frames/PanelFrame";
import { useChat } from "./hooks/useChat";
import { useSize } from "./hooks/useSize";
import { getMemory } from "./lib/memory";
import { getUser, onAuthStateChange } from "./lib/supabase";
import { cn } from "./utils/cn";

export default function App() {
  const chat = useChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [memoryCount, setMemoryCount] = useState<number>(() => getMemory().length);

  const panel = useSize<HTMLDivElement>();
  const empty = chat.messages.length === 0 && chat.state === "idle";
  const busy = chat.state !== "idle";

  // Auth state tracking
  useEffect(() => {
    getUser().then(setUser);
    const sub = onAuthStateChange((u) => setUser(u));
    return () => sub.unsubscribe();
  }, []);

  // Memory count listener
  useEffect(() => {
    const updateCount = () => setMemoryCount(getMemory().length);
    window.addEventListener("dai:memory-updated", updateCount as EventListener);
    return () => window.removeEventListener("dai:memory-updated", updateCount as EventListener);
  }, []);

  // Global keyboard shortcuts (Ctrl+K: New Chat, Escape: Close Modals)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        chat.newChat();
      } else if (e.key === "Escape") {
        setHistoryOpen(false);
        setAccountOpen(false);
        setMemoryOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chat]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ink text-cream">
      <SvgDefs />
      <Ambient state={chat.state} visible={empty} />

      <Header
        onHistory={() => setHistoryOpen(true)}
        onNewChat={chat.newChat}
        onMemory={() => setMemoryOpen(true)}
        onAccount={() => setAccountOpen(true)}
        historyOpen={historyOpen}
        memoryCount={memoryCount}
        user={user}
      />

      <main className="relative z-10 flex-1 px-5 pt-3 pb-[58px] md:px-7 md:pt-4 md:pb-[68px]">
        {/* Branch Breadcrumb Navigation Bar (when viewing a branch) */}
        {chat.breadcrumbs.length > 1 && (
          <div className="mx-auto mb-2 flex max-w-[880px] items-center justify-between rounded border border-gold/25 bg-black/40 px-3.5 py-1.5 backdrop-blur-sm">
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

        {/* Main D'Ai framed panel container */}
        <div ref={panel.ref} className="relative h-full">
          <PanelFrame w={panel.w} h={panel.h} />

          {/* Loading Shimmer Transition */}
          {chat.isLoadingChat && (
            <div className="absolute inset-[2px] z-30 flex items-center justify-center rounded-[15px] bg-black/40 backdrop-blur-[2px]">
              <div className="flex items-center gap-2 rounded border border-gold/40 bg-ink px-4 py-2 text-gold shadow-lg">
                <span className="h-2 w-2 rounded-full bg-gold animate-ping" />
                <span className="font-display italic text-[14px]">Loading chronicle…</span>
              </div>
            </div>
          )}

          <div
            className={cn(
              "scroll-gold absolute inset-[1px] overflow-y-auto overflow-x-hidden rounded-[15px]",
              empty ? "flex items-center justify-center pb-20" : "pb-24",
            )}
          >
            {empty ? (
              <div className="flex flex-col items-center justify-center gap-6 px-4 text-center max-w-4xl mx-auto -translate-y-4">
                {/* Context & History-driven prompt suggestions (blank if no prior context) */}
                <PromptSuggestions
                  conversations={chat.conversations}
                  onSelectPrompt={(prompt) => chat.send(prompt)}
                />

                <p className="rise font-display text-[20px] md:text-[22px] italic tracking-wide text-muted select-none">
                  “The sovereign flame of ornate intelligence.”
                </p>
              </div>
            ) : (
              <Messages
                messages={chat.messages}
                state={chat.state}
                onBranch={(msgId) => chat.createBranch(chat.activeId || undefined, msgId)}
              />
            )}
          </div>

          {/* Message Box: Positioned so the chat container bottom border ends in the middle of the message box */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center translate-y-1/2 px-3 md:px-8 pointer-events-none">
            <div className="w-full max-w-[920px] pointer-events-auto flex justify-center">
              <ChatInput onSend={chat.send} onStop={chat.stop} busy={busy} mode={chat.mode} />
            </div>
          </div>
        </div>
      </main>

      {/* Saved Chats History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={chat.conversations}
        projects={chat.projects}
        activeId={chat.activeId}
        onOpen={chat.openConversation}
        onDelete={chat.deleteConversation}
        onPin={chat.pinConversation}
        onRename={chat.renameConversation}
        onBranch={(id) => chat.createBranch(id)}
        onCreateProject={chat.createProject}
        onRenameProject={chat.renameProject}
        onDeleteProject={chat.deleteProject}
        onAssignToProject={chat.assignToProject}
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
    </div>
  );
}
