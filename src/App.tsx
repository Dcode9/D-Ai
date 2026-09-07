import { useState } from "react";
import { Ambient } from "./components/Ambient";
import { ChatInput } from "./components/ChatInput";
import { Header } from "./components/Header";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { Messages } from "./components/Messages";
import { ModeButtons } from "./components/ModeButtons";
import { SvgDefs } from "./components/SvgDefs";
import { PanelFrame } from "./components/frames/PanelFrame";
import { useChat } from "./hooks/useChat";
import { useSize } from "./hooks/useSize";
import { cn } from "./utils/cn";

export default function App() {
  const chat = useChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const panel = useSize<HTMLDivElement>();
  const empty = chat.messages.length === 0 && chat.state === "idle";
  const busy = chat.state !== "idle";

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ink text-cream">
      <SvgDefs />
      <Ambient state={chat.state} visible={empty} />

      <Header onHistory={() => setHistoryOpen(true)} onNewChat={chat.newChat} historyOpen={historyOpen} />

      <main className="relative z-10 flex-1 px-3 pb-5 pt-2 md:px-8 md:pb-6">
        {/* Main D'Ai framed panel container */}
        <div ref={panel.ref} className="relative h-full">
          <PanelFrame w={panel.w} h={panel.h} />

          <div
            className={cn(
              "scroll-gold absolute inset-[1px] overflow-y-auto overflow-x-hidden rounded-[15px]",
              empty ? "flex items-center justify-center pb-24" : "pb-32",
            )}
          >
            {empty ? (
              <div className="flex flex-col items-center justify-center gap-7 md:gap-9 px-4 text-center max-w-5xl mx-auto -translate-y-4">
                <ModeButtons mode={chat.mode} onSelect={chat.setMode} />

                <p
                  key={chat.mode ?? "none"}
                  className="rise font-display text-[20px] md:text-[22px] italic tracking-wide text-muted"
                >
                  {chat.mode ? `${chat.mode} mode — ask away.` : "Choose a discipline, or simply begin."}
                </p>
              </div>
            ) : (
              <Messages messages={chat.messages} state={chat.state} />
            )}
          </div>

          {/* Message Box: Positioned cleanly INSIDE the D'Ai panel container, perfectly centered */}
          <div className="absolute inset-x-0 bottom-4 z-20 px-3 md:bottom-6 md:px-8 flex justify-center pointer-events-none">
            <div className="w-full max-w-[780px] pointer-events-auto">
              <ChatInput onSend={chat.send} onStop={chat.stop} busy={busy} mode={chat.mode} />
            </div>
          </div>
        </div>
      </main>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={chat.conversations}
        activeId={chat.activeId}
        onOpen={chat.openConversation}
        onDelete={chat.deleteConversation}
      />
    </div>
  );
}
