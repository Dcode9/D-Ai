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

      <main className="relative z-10 flex-1 px-5 pt-5 pb-[58px] md:px-7 md:pt-7 md:pb-[68px]">
        {/* Main D'Ai framed panel container */}
        <div ref={panel.ref} className="relative h-full">
          <PanelFrame w={panel.w} h={panel.h} />

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
              <Messages messages={chat.messages} state={chat.state} />
            )}
          </div>

          {/* Message Box: Positioned so the chat container bottom border ends in the middle of the message box */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center translate-y-1/2 px-3 md:px-8 pointer-events-none">
            <div className="w-full max-w-[780px] pointer-events-auto">
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
        activeId={chat.activeId}
        onOpen={chat.openConversation}
        onDelete={chat.deleteConversation}
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
