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
      {/* Requirement: All ambient background blobs hidden after the first interaction/response */}
      <Ambient state={chat.state} visible={empty} />

      <Header onHistory={() => setHistoryOpen(true)} onNewChat={chat.newChat} historyOpen={historyOpen} />

      <main className="relative z-10 flex-1 px-3 pb-[88px] pt-3 md:px-8">
        {/* framed panel */}
        <div ref={panel.ref} className="relative h-full">
          <PanelFrame w={panel.w} h={panel.h} />

          <div
            className={cn(
              "scroll-gold absolute inset-[1px] overflow-y-auto overflow-x-hidden rounded-[15px]",
              empty ? "flex items-center justify-center" : "pb-24",
            )}
          >
            {empty ? (
              <div className="flex -translate-y-8 flex-col items-center gap-10 px-6">
                <ModeButtons mode={chat.mode} onSelect={chat.setMode} />
                <p
                  key={chat.mode ?? "none"}
                  className="rise font-display text-[19px] italic tracking-wide text-muted"
                >
                  {chat.mode ? `${chat.mode} mode — ask away.` : "Choose a discipline, or simply begin."}
                </p>
              </div>
            ) : (
              /* Requirement: Mode buttons (Image, Video, Code, Text, Music) hidden after first response */
              <Messages messages={chat.messages} state={chat.state} />
            )}
          </div>
        </div>

        {/* banner input, straddling the panel's bottom rule */}
        <div className="absolute inset-x-0 bottom-[32px] z-20 px-2 md:px-8">
          <ChatInput onSend={chat.send} onStop={chat.stop} busy={busy} mode={chat.mode} />
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
