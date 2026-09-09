import { useCallback, useEffect, useRef, useState } from "react";
import type { AuraState } from "../components/Aura";
import { getMemory, addMemoryFact, removeMemoryFact } from "../lib/memory";
import {
  getUser,
  createCloudChat,
  updateCloudChat,
  deleteCloudChat,
  saveCloudMessage,
  listCloudChats,
  onAuthStateChange,
} from "../lib/supabase";

export type Mode = "Image" | "Video" | "Code" | "Text" | "Music";
export const MODES: Mode[] = ["Image", "Video", "Code", "Text", "Music"];

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WorkStep =
  | {
      id: string;
      type: "thought";
      durationSec: number;
      content: string;
      isLive?: boolean;
    }
  | {
      id: string;
      type: "search";
      query: string;
      websitesFound: number;
      results: SearchResult[];
      isLive?: boolean;
    }
  | {
      id: string;
      type: "image_gen";
      prompt: string;
      imageUrl?: string;
      isLive?: boolean;
    }
  | {
      id: string;
      type: "memory";
      action: "add" | "remove" | "recall";
      fact?: string;
      isLive?: boolean;
    };

export type WorkData = {
  totalDurationSec: number;
  steps: WorkStep[];
  isWorking?: boolean;
  statusText?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: Mode | null;
  streaming?: boolean;
  imageUrl?: string;
  work?: WorkData;
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
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 40)));
    } catch (e) {
      console.warn("Storage quota exceeded", e);
    }
  }, [conversations]);

  // Load cloud conversations when user is logged in
  useEffect(() => {
    let active = true;
    async function syncCloud() {
      const u = await getUser();
      if (!u || !active) return;
      try {
        const cloudChats = await listCloudChats();
        if (cloudChats.length > 0 && active) {
          setConversations((prev) => {
            const map = new Map<string, Conversation>();
            prev.forEach((c) => map.set(c.id, c));
            cloudChats.forEach((cc) => {
              if (!map.has(cc.id)) {
                map.set(cc.id, {
                  id: cc.id,
                  title: cc.title || "Cloud Chat",
                  createdAt: new Date(cc.created_at).getTime() || Date.now(),
                  messages: [],
                });
              }
            });
            return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
          });
        }
      } catch (err) {
        console.warn("[D'Ai] Cloud chat fetch failed:", err);
      }
    }
    syncCloud();
    const sub = onAuthStateChange(() => {
      syncCloud();
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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

      // Background cloud sync for authenticated users
      getUser().then((user) => {
        if (!user) return;
        const firstUser = msgs.find((m) => m.role === "user");
        const title = firstUser ? firstUser.content.slice(0, 48) : "Untitled";
        createCloudChat(title, { local_id: id }).then((cloudChat) => {
          const cloudChatId = cloudChat?.id || id;
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg) {
            saveCloudMessage(cloudChatId, lastMsg.role, lastMsg.content, { mode: lastMsg.mode });
          }
        }).catch(() => {});
      }).catch(() => {});
    },
    [],
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setState("idle");
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

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

      const asstId = uid();
      const workStartTime = Date.now();

      let activeWorkData: WorkData = {
        totalDurationSec: 0,
        steps: [],
        isWorking: true,
        statusText: "Thinking…",
      };

      setMessages((m) => [
        ...m,
        {
          id: asstId,
          role: "assistant",
          content: "",
          mode,
          streaming: true,
          work: activeWorkData,
        },
      ]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const updateWork = (updater: (prev: WorkData) => WorkData) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== asstId) return msg;
            activeWorkData = updater(msg.work || activeWorkData);
            return { ...msg, work: activeWorkData };
          }),
        );
      };

      // Conversation messages sent to the API with sovereign agent instructions and personal memory
      const memoryFacts = getMemory();
      let systemPrompt =
        "You are D'Ai, an exquisite, sovereign intelligence crafted with peerless elegance, intellectual depth, and uncompromising clarity.";
      if (memoryFacts.length > 0) {
        systemPrompt += `\n\n## Remembered Context About the User\nYou know the following personal facts, preferences, and context about the user:\n${memoryFacts.map((f) => `• ${f}`).join("\n")}\nSeamlessly personalize your responses using these facts whenever appropriate.`;
      }
      systemPrompt += `\n\n## Tools & Capabilities\nYou have native capabilities:
- \`web_search\`: Call this whenever the user asks for real-time information, recent events, market facts, technical specifications, or verification.
- \`manage_memory\`: Call this to store ('add'), delete ('remove'), or view ('recall') important persistent user preferences, identity, tech stack, or background facts.
- \`generate_image\`: Call this to render visual scenes, paintings, or artistic illustrations.`;

      let conversationHistory: any[] = [
        { role: "system", content: systemPrompt },
        ...currentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      let rawBuffer = "";
      let displayedText = "";
      let isStreamingActive = false;
      let finalImageUrl: string | undefined = undefined;
      let thoughtStartTime = Date.now();
      let currentThoughtId: string | null = null;
      let currentThoughtContent = "";
      let loopCount = 0;
      const maxLoops = 5;

      const startAnimationLoop = () => {
        const tick = () => {
          if (displayedText.length < rawBuffer.length) {
            const diff = rawBuffer.length - displayedText.length;
            const step = Math.max(1, Math.ceil(diff / 4));
            displayedText = rawBuffer.slice(0, displayedText.length + step);

            setMessages((prev) =>
              prev.map((x) =>
                x.id === asstId ? { ...x, content: displayedText } : x,
              ),
            );
          }

          if (isStreamingActive || displayedText.length < rawBuffer.length) {
            animFrameRef.current = requestAnimationFrame(tick);
          }
        };

        animFrameRef.current = requestAnimationFrame(tick);
      };

      try {
        // AGENTIC HARNESS LOOP: executes multi-turn tool calling & reasoning
        while (loopCount < maxLoops && !controller.signal.aborted) {
          loopCount++;
          let currentTurnToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
          let turnContent = "";

          try {
            const response = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: conversationHistory,
                stream: true,
                mode,
              }),
              signal: controller.signal,
            });

            if (response.ok && response.body) {
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let sseChunkBuffer = "";
              let inThinkTag = false;

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseChunkBuffer += decoder.decode(value, { stream: true });
                const lines = sseChunkBuffer.split("\n");
                sseChunkBuffer = lines.pop() || "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith("data: ")) continue;
                  const raw = trimmed.slice(6);
                  if (raw === "[DONE]") continue;

                  try {
                    const parsed = JSON.parse(raw);
                    const choice = parsed.choices?.[0];
                    const delta = choice?.delta;

                    // 1. Accumulate reasoning/thinking tokens
                    const reasoningChunk = delta?.reasoning || delta?.reasoning_content || delta?.thought || parsed?.reasoning_summary?.content;
                    if (reasoningChunk) {
                      if (!currentThoughtId) {
                        currentThoughtId = uid();
                        thoughtStartTime = Date.now();
                        updateWork((w) => ({
                          ...w,
                          statusText: "Thinking…",
                          steps: [
                            ...w.steps,
                            {
                              id: currentThoughtId!,
                              type: "thought",
                              durationSec: 0,
                              content: "",
                              isLive: true,
                            },
                          ],
                        }));
                      }
                      currentThoughtContent += reasoningChunk;
                      const elapsedSec = Math.max(0.1, (Date.now() - thoughtStartTime) / 1000);
                      updateWork((w) => ({
                        ...w,
                        statusText: "Thinking…",
                        steps: w.steps.map((s) =>
                          s.id === currentThoughtId
                            ? { ...s, content: currentThoughtContent, durationSec: elapsedSec }
                            : s,
                        ),
                      }));
                    }

                    // 2. Accumulate tool calling chunks
                    if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
                      for (const tc of delta.tool_calls) {
                        const idx = tc.index ?? 0;
                        if (!currentTurnToolCalls[idx]) {
                          currentTurnToolCalls[idx] = {
                            id: tc.id || `call_${uid()}`,
                            name: tc.function?.name || "",
                            arguments: tc.function?.arguments || "",
                          };
                        } else {
                          if (tc.id) currentTurnToolCalls[idx].id = tc.id;
                          if (tc.function?.name) currentTurnToolCalls[idx].name += tc.function.name;
                          if (tc.function?.arguments) currentTurnToolCalls[idx].arguments += tc.function.arguments;
                        }
                      }
                    }

                    // 3. Direct answer content & <think> block handling
                    const rawContentChunk = delta?.content;
                    if (rawContentChunk) {
                      turnContent += rawContentChunk;
                      let chunkText = rawContentChunk;

                      const thinkStartRegex = /<(?:think|ththink|thought|reasoning)>/i;
                      const thinkEndRegex = /<\/(?:think|ththink|thought|reasoning)>/i;

                      if (!inThinkTag && thinkStartRegex.test(chunkText)) {
                        inThinkTag = true;
                        if (!currentThoughtId) {
                          currentThoughtId = uid();
                          thoughtStartTime = Date.now();
                          updateWork((w) => ({
                            ...w,
                            statusText: "Thinking…",
                            steps: [
                              ...w.steps,
                              {
                                id: currentThoughtId!,
                                type: "thought",
                                durationSec: 0,
                                content: "",
                                isLive: true,
                              },
                            ],
                          }));
                        }
                        const parts = chunkText.split(thinkStartRegex);
                        if (parts[0]) {
                          rawBuffer += parts[0];
                        }
                        chunkText = parts[1] || "";
                      }

                      if (inThinkTag) {
                        if (thinkEndRegex.test(chunkText)) {
                          const parts = chunkText.split(thinkEndRegex);
                          currentThoughtContent += parts[0];
                          inThinkTag = false;
                          chunkText = parts[1] || "";
                        } else {
                          currentThoughtContent += chunkText;
                          chunkText = "";
                        }

                        const elapsedSec = Math.max(0.1, (Date.now() - thoughtStartTime) / 1000);
                        updateWork((w) => ({
                          ...w,
                          statusText: "Thinking…",
                          steps: w.steps.map((s) =>
                            s.id === currentThoughtId
                              ? { ...s, content: currentThoughtContent, durationSec: elapsedSec }
                              : s,
                          ),
                        }));
                      }

                      // When direct answer content starts and no tools are pending,
                      // collapse the execution work into "Worked for x seconds ▾"
                      if (!inThinkTag && currentTurnToolCalls.length === 0 && chunkText) {
                        setState((curr) => (curr !== "answering" ? "answering" : curr));

                        const elapsedThoughtSec = Math.max(0.1, (Date.now() - thoughtStartTime) / 1000);
                        const totalDurationSec = Math.max(0.2, (Date.now() - workStartTime) / 1000);

                        updateWork((w) => ({
                          ...w,
                          isWorking: false,
                          totalDurationSec: w.totalDurationSec || totalDurationSec,
                          statusText: "",
                          steps: w.steps.map((s) =>
                            s.id === currentThoughtId && s.isLive
                              ? {
                                  ...s,
                                  isLive: false,
                                  ...(s.type === "thought" ? { durationSec: s.durationSec || elapsedThoughtSec } : {}),
                                }
                              : s,
                          ),
                        }));

                        rawBuffer += chunkText;
                        if (!isStreamingActive) {
                          isStreamingActive = true;
                          startAnimationLoop();
                        }
                      }
                    }
                  } catch (_) {
                    // Raw string chunk fallback
                  }
                }
              }
            }
          } catch (apiErr: any) {
            if (apiErr?.name === "AbortError") return;
            console.warn("[D-Ai Harness] API error:", apiErr);
          }

          // Filter out unpopulated tool call entries
          currentTurnToolCalls = currentTurnToolCalls.filter((tc) => tc && tc.name);

          // If tool calls were emitted in this turn, execute them!
          if (currentTurnToolCalls.length > 0) {
            // Finalize preceding thought step if one was active
            if (currentThoughtId) {
              const elapsedThoughtSec = Math.max(0.1, (Date.now() - thoughtStartTime) / 1000);
              updateWork((w) => ({
                ...w,
                steps: w.steps.map((s) =>
                  s.id === currentThoughtId
                    ? { ...s, isLive: false, durationSec: elapsedThoughtSec }
                    : s,
                ),
              }));
              currentThoughtId = null;
              currentThoughtContent = "";
            }

            // Record assistant message with tool calls in history
            conversationHistory.push({
              role: "assistant",
              content: turnContent || null,
              tool_calls: currentTurnToolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
              })),
            });

            // Execute each tool call
            for (const toolCall of currentTurnToolCalls) {
              if (toolCall.name === "web_search") {
                let query = prompt;
                try {
                  const parsed = JSON.parse(toolCall.arguments || "{}");
                  if (parsed.query) query = parsed.query;
                } catch {
                  query = prompt;
                }

                const searchStepId = uid();
                updateWork((w) => ({
                  ...w,
                  statusText: "Searching the web…",
                  steps: [
                    ...w.steps,
                    {
                      id: searchStepId,
                      type: "search",
                      query,
                      websitesFound: 0,
                      results: [],
                      isLive: true,
                    },
                  ],
                }));

                let foundResults: SearchResult[] = [];
                let directSummary: string | undefined = undefined;
                try {
                  const searchRes = await fetch("/api/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query }),
                    signal: controller.signal,
                  });
                  if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.answer) directSummary = searchData.answer;
                    const items = Array.isArray(searchData.results) ? searchData.results : [];
                    foundResults = items.slice(0, 8).map((item: any) => ({
                      title: item.title || query,
                      url: item.url || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                      snippet: (item.content || item.snippet || "").slice(0, 360),
                    }));
                  }
                } catch (searchErr) {
                  console.warn("Search execution error:", searchErr);
                }

                // If 0 results, provide fallback web knowledge
                if (foundResults.length === 0) {
                  foundResults = [
                    {
                      title: `${query} — Web Search`,
                      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                      snippet: `Searched web indexes for “${query}”. Context gathered for synthesis.`,
                    },
                  ];
                }

                // Update search step
                updateWork((w) => ({
                  ...w,
                  statusText: `Found ${foundResults.length} websites`,
                  steps: w.steps.map((s) =>
                    s.id === searchStepId
                      ? {
                          ...s,
                          isLive: false,
                          websitesFound: foundResults.length,
                          results: foundResults,
                        }
                      : s,
                  ),
                }));

                const toolPayload = {
                  search_query: query,
                  direct_summary: directSummary,
                  sources: foundResults.map((r, idx) => ({
                    source_number: idx + 1,
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet,
                  })),
                  grounding_instruction:
                    "Synthesize your response STRICTLY using these verified sources. DO NOT invent fake models, benchmarks, or unverified claims. Cite each verified development with clickable Markdown links [Title](url).",
                };

                conversationHistory.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: "web_search",
                  content: JSON.stringify(toolPayload),
                });
              } else if (toolCall.name === "generate_image") {
                let imgPrompt = prompt;
                let aspectRatio = "1:1";
                try {
                  const parsed = JSON.parse(toolCall.arguments || "{}");
                  if (parsed.prompt) imgPrompt = parsed.prompt;
                  if (parsed.aspect_ratio) aspectRatio = parsed.aspect_ratio;
                } catch {}

                const imgStepId = uid();
                updateWork((w) => ({
                  ...w,
                  statusText: "Composing visual representation…",
                  steps: [
                    ...w.steps,
                    {
                      id: imgStepId,
                      type: "image_gen",
                      prompt: imgPrompt,
                      isLive: true,
                    },
                  ],
                }));

                let generatedUrl = "";
                try {
                  const imgRes = await fetch("/api/image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: imgPrompt, aspect_ratio: aspectRatio }),
                    signal: controller.signal,
                  });
                  if (imgRes.ok) {
                    const contentType = imgRes.headers.get("content-type") || "";
                    if (contentType.includes("image/")) {
                      const blob = await imgRes.blob();
                      generatedUrl = URL.createObjectURL(blob);
                    } else {
                      const imgData = await imgRes.json();
                      generatedUrl = imgData.url || imgData.image || imgData.imageUrl || "";
                    }
                  }
                } catch (imgErr) {
                  console.warn("Image call error:", imgErr);
                }

                if (!generatedUrl) {
                  const seed = Math.floor(Math.random() * 1000000);
                  generatedUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
                }

                finalImageUrl = generatedUrl;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === asstId ? { ...msg, imageUrl: generatedUrl } : msg,
                  ),
                );

                updateWork((w) => ({
                  ...w,
                  statusText: "Generated visual artwork",
                  steps: w.steps.map((s) =>
                    s.id === imgStepId ? { ...s, isLive: false, imageUrl: generatedUrl } : s,
                  ),
                }));

                conversationHistory.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: "generate_image",
                  content: JSON.stringify({ success: true, imageUrl: generatedUrl }),
                });
              } else if (toolCall.name === "manage_memory") {
                let action: "add" | "remove" | "recall" = "recall";
                let fact = "";
                try {
                  const parsed = JSON.parse(toolCall.arguments || "{}");
                  if (parsed.action) action = parsed.action;
                  if (parsed.fact) fact = parsed.fact;
                } catch {}

                const memStepId = uid();
                updateWork((w) => ({
                  ...w,
                  statusText: action === "add" ? "Remembering personal context…" : "Accessing user memory…",
                  steps: [
                    ...w.steps,
                    {
                      id: memStepId,
                      type: "memory",
                      action,
                      fact,
                      isLive: true,
                    },
                  ],
                }));

                let resultPayload: Record<string, unknown> = {};
                if (action === "add" && fact) {
                  const updated = addMemoryFact(fact);
                  resultPayload = {
                    status: "success",
                    message: `Fact "${fact}" stored in user memory.`,
                    all_facts: updated,
                  };
                } else if (action === "remove" && fact) {
                  const current = getMemory();
                  const idx = current.findIndex((f) => f.toLowerCase().includes(fact.toLowerCase()));
                  const updated = idx !== -1 ? removeMemoryFact(idx) : current;
                  resultPayload = {
                    status: "success",
                    message: `Fact removed from user memory.`,
                    all_facts: updated,
                  };
                } else {
                  resultPayload = {
                    status: "success",
                    all_facts: getMemory(),
                  };
                }

                updateWork((w) => ({
                  ...w,
                  statusText: action === "add" ? "Personal context remembered" : "User memory recalled",
                  steps: w.steps.map((s) => (s.id === memStepId ? { ...s, isLive: false } : s)),
                }));

                conversationHistory.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: "manage_memory",
                  content: JSON.stringify(resultPayload),
                });
              }
            }

            // Continue loop to generate synthesis or next response
            continue;
          }

          // If turn produced final answer without tool calls, exit loop!
          break;
        }

        // Resilient fallback if no text content was produced
        if (!rawBuffer.trim()) {
          // Check if user specifically requested an image
          if (mode === "Image" || /image/i.test(prompt)) {
            const seed = Math.floor(Math.random() * 1000000);
            finalImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
            rawBuffer = `Here is the visual artwork for: “${prompt}”`;
          } else {
            try {
              const fallbackRes = await fetch(
                `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&system=${encodeURIComponent(
                  "You are D'Ai, an ornate and profound intelligence created by Dhairya Shah. Respond thoughtfully in elegant markdown.",
                )}`,
                { signal: controller.signal },
              );
              if (fallbackRes.ok) {
                rawBuffer = await fallbackRes.text();
              }
            } catch (_) {}

            if (!rawBuffer.trim()) {
              rawBuffer = compose(prompt, mode);
            }
          }

          setState("answering");
          if (!isStreamingActive) {
            isStreamingActive = true;
            startAnimationLoop();
          }
        }

        // Finalize any active thought step and filter out empty phantom thoughts
        const finalThoughtDuration = Math.max(0.1, (Date.now() - thoughtStartTime) / 1000);
        const totalDurationSec = Math.max(0.2, (Date.now() - workStartTime) / 1000);

        updateWork((w) => ({
          ...w,
          isWorking: false,
          totalDurationSec: w.totalDurationSec || totalDurationSec,
          steps: w.steps
            .map((s) =>
              s.isLive
                ? { ...s, isLive: false, durationSec: (s as any).durationSec || finalThoughtDuration }
                : s,
            )
            .filter((s) => {
              if (s.type === "thought") {
                return Boolean(s.content && s.content.trim());
              }
              return true;
            }),
        }));

        // Allow streaming catch-up loop to finish
        isStreamingActive = false;
        await new Promise<void>((resolve) => {
          const startTime = Date.now();
          const checkDone = () => {
            if (
              controller.signal.aborted ||
              displayedText.length >= rawBuffer.length ||
              Date.now() - startTime > 3000
            ) {
              resolve();
            } else {
              setTimeout(checkDone, 30);
            }
          };
          checkDone();
        });

        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }

        const done = [
          ...currentMessages,
          {
            id: asstId,
            role: "assistant" as const,
            content: rawBuffer,
            mode,
            streaming: false,
            imageUrl: finalImageUrl,
            work: {
              ...activeWorkData,
              isWorking: false,
              totalDurationSec,
            },
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
    stop();
    setMessages([]);
    setActiveId(null);
    setMode(null);
    setState("idle");
  }, [stop]);

  const openConversation = useCallback(
    (id: string) => {
      const c = conversations.find((x) => x.id === id);
      if (!c) return;
      stop();
      setActiveId(id);
      setMessages(c.messages);
      setMode(c.messages[c.messages.length - 1]?.mode ?? null);
      setState("idle");
    },
    [conversations, stop],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      deleteCloudChat(id).catch(() => {});
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
    stop,
    newChat,
    openConversation,
    deleteConversation,
  };
}
