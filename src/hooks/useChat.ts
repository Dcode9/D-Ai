import { useCallback, useEffect, useRef, useState } from "react";
import type { AuraState } from "../components/Aura";

export type Mode = "Image" | "Video" | "Code" | "Text" | "Music";
export const MODES: Mode[] = ["Image", "Video", "Code", "Text", "Music"];

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: Mode | null;
  streaming?: boolean;
  imageUrl?: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

const STORAGE_KEY = "dai.conversations.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

const OPENERS = [
  "Certainly.",
  "A fine question.",
  "Let us consider this carefully.",
  "With pleasure.",
  "An intriguing request.",
];

function compose(prompt: string, mode: Mode | null): string {
  const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
  const short = prompt.length > 60 ? prompt.slice(0, 57).trimEnd() + "…" : prompt;

  switch (mode) {
    case "Image":
      return `${opener} I would render “${short}” as a single, deliberate composition.\n\nPalette: charcoal grounds with plum shadows and amber highlights, lit from the upper left so the grain reads as texture rather than noise. Framing: a tight three-quarter view, shallow depth, and a soft vignette to hold the eye.\n\nSay the word and I will vary the mood — gilded, austere, or nocturnal.`;
    case "Video":
      return `${opener} For “${short}” I would build a sequence in three movements.\n\n1. Establishing — a slow push-in through haze, 6 seconds.\n2. Development — cut on motion, letting light rake across surfaces.\n3. Resolution — hold on stillness, then fade through black to a title card.\n\nI can draft a shot list with lens choices and timing next.`;
    case "Code":
      return `${opener} Here is a clean starting point for “${short}”:\n\n\`\`\`ts\nexport function solve(input: string): string {\n  const tokens = input.trim().split(/\\s+/);\n  return tokens\n    .map((t) => t[0].toUpperCase() + t.slice(1))\n    .join(" ");\n}\n\`\`\`\n\nIt is pure, typed, and trivially testable. Tell me the runtime and constraints and I will harden it.`;
    case "Music":
      return `${opener} For “${short}”, imagine a piece in D minor at 72 bpm.\n\nA felt piano states the theme over a low cello drone; brushed percussion arrives in the second phrase, and a muted trumpet answers in the bridge. The final cadence resolves to the relative major — quiet, but not entirely at peace.\n\nI can sketch chord voicings or a rhythmic grid if you like.`;
    case "Text":
    default:
      return `${opener} Regarding “${short}” —\n\nThe heart of the matter is clarity: decide what must be true at the end, then remove everything that does not move toward it. Begin with the strongest claim, support it with one vivid particular, and close before the reader tires.\n\nWould you like this expanded into an outline, or refined into a final draft?`;
  }
}

function load(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(load);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<AuraState>("idle");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 40)));
    } catch (e) {
      console.warn("Storage quota exceeded", e);
    }
  }, [conversations]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const persist = useCallback(
    (id: string, msgs: Message[]) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        const firstUser = msgs.find((m) => m.role === "user");
        const title = firstUser ? firstUser.content.slice(0, 48) : "Untitled";
        const conv: Conversation = {
          id,
          title,
          createdAt: idx >= 0 ? prev[idx].createdAt : Date.now(),
          messages: msgs.map((m) => ({ ...m, streaming: false })),
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = conv;
          return next;
        }
        return [conv, ...prev];
      });
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || state !== "idle") return;

      const convId = activeId ?? uid();
      if (!activeId) setActiveId(convId);

      const userMsg: Message = { id: uid(), role: "user", content: prompt, mode };
      const currentMessages = [...messages, userMsg];
      setMessages(currentMessages);
      setState("thinking");

      // Check if image mode or image generation is requested
      const isImageRequest =
        mode === "Image" ||
        /^(generate|create|draw|paint|sketch)\s+(an?\s+)?image/i.test(prompt) ||
        /<<GENERATE_IMAGE:/i.test(prompt);

      if (isImageRequest) {
        const asstId = uid();
        setMessages((m) => [
          ...m,
          {
            id: asstId,
            role: "assistant",
            content: `Composing visual representation of “${prompt}”…`,
            mode: "Image",
            streaming: true,
          },
        ]);

        try {
          // Attempt real /api/image endpoint
          let imageUrl = "";
          try {
            const imgRes = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
            });

            if (imgRes.ok) {
              const contentType = imgRes.headers.get("content-type") || "";
              if (contentType.includes("image/")) {
                const blob = await imgRes.blob();
                imageUrl = URL.createObjectURL(blob);
              } else {
                const data = await imgRes.json();
                imageUrl = data.url || data.image || data.imageUrl || "";
              }
            }
          } catch (apiErr) {
            console.warn("Direct /api/image call failed, using fallback:", apiErr);
          }

          // Fallback image via Pollinations free high-quality engine
          if (!imageUrl) {
            const seed = Math.floor(Math.random() * 1000000);
            imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
          }

          setState("answering");
          const finalContent = `Here is the visual creation for: “${prompt}”`;
          const finalMessages = [
            ...currentMessages,
            {
              id: asstId,
              role: "assistant" as const,
              content: finalContent,
              imageUrl,
              mode: "Image" as Mode,
            },
          ];

          setMessages(finalMessages);
          setState("idle");
          persist(convId, finalMessages);
          return;
        } catch (err) {
          console.error("Image generation error:", err);
          setState("idle");
        }
      }

      // Standard Text / Code / Video / Music / General Chat
      const asstId = uid();
      setMessages((m) => [
        ...m,
        {
          id: asstId,
          role: "assistant",
          content: "",
          mode,
          streaming: true,
        },
      ]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const historyPayload = currentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let accumulated = "";
        let streamSuccess = false;

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: historyPayload,
              stream: true,
              mode,
            }),
            signal: controller.signal,
          });

          if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const raw = trimmed.slice(6);
                if (raw === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(raw);
                  const chunk =
                    parsed.choices?.[0]?.delta?.content ||
                    parsed.choices?.[0]?.text ||
                    "";
                  if (chunk) {
                    if (!accumulated) {
                      setState("answering");
                    }
                    accumulated += chunk;
                    setMessages((m) =>
                      m.map((x) => (x.id === asstId ? { ...x, content: accumulated } : x)),
                    );
                    streamSuccess = true;
                  }
                } catch {
                  // If raw plain text
                  if (raw && !raw.startsWith("{")) {
                    accumulated += raw;
                    setMessages((m) =>
                      m.map((x) => (x.id === asstId ? { ...x, content: accumulated } : x)),
                    );
                    streamSuccess = true;
                  }
                }
              }
            }
          }
        } catch (apiErr) {
          console.warn("Direct /api/chat error, attempting resilient fallback:", apiErr);
        }

        // Resilient fallback if /api/chat returned no content (e.g. offline or missing server keys)
        if (!streamSuccess || !accumulated.trim()) {
          try {
            // Free Pollinations AI streaming / completions fallback
            const fallbackRes = await fetch(
              `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&system=${encodeURIComponent(
                "You are D'Ai, an ornate and profound intelligence created by Dhairya Shah. Respond thoughtfully in elegant markdown.",
              )}`,
              { signal: controller.signal },
            );
            if (fallbackRes.ok) {
              setState("answering");
              accumulated = await fallbackRes.text();
              setMessages((m) =>
                m.map((x) => (x.id === asstId ? { ...x, content: accumulated } : x)),
              );
              streamSuccess = true;
            }
          } catch (pollErr) {
            console.warn("Pollinations fallback failed, utilizing local composer:", pollErr);
          }
        }

        // Final fallback: Fable 5.1 ornamental composition
        if (!streamSuccess || !accumulated.trim()) {
          setState("answering");
          accumulated = compose(prompt, mode);
          setMessages((m) =>
            m.map((x) => (x.id === asstId ? { ...x, content: accumulated } : x)),
          );
        }

        const done = [
          ...currentMessages,
          {
            id: asstId,
            role: "assistant" as const,
            content: accumulated,
            mode,
          },
        ];
        setMessages(done);
        setState("idle");
        persist(convId, done);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Chat failure:", err);
        setState("idle");
      }
    },
    [activeId, messages, mode, persist, state],
  );

  const newChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setActiveId(null);
    setMode(null);
    setState("idle");
  }, []);

  const openConversation = useCallback(
    (id: string) => {
      const c = conversations.find((x) => x.id === id);
      if (!c) return;
      abortControllerRef.current?.abort();
      setActiveId(id);
      setMessages(c.messages);
      setMode(c.messages[c.messages.length - 1]?.mode ?? null);
      setState("idle");
    },
    [conversations],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) newChat();
    },
    [activeId, newChat],
  );

  return {
    conversations,
    activeId,
    messages,
    mode,
    setMode,
    state,
    send,
    newChat,
    openConversation,
    deleteConversation,
  };
}
