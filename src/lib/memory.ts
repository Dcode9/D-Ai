export const MEMORY_STORAGE_KEY = "dai_personal_memory_v2";
const LEGACY_MEMORY_KEY = "dai_personal_memory_v1";

export interface MemoryTopic {
  id: string;
  topic: string; // Concise domain or subject (e.g. "React Architecture", "Quantum Mechanics", "User Stack")
  summary: string; // Distilled core insight or persistent principle
  detail?: string; // Rich context for active or evolving focus (kept detailed until closed)
  status: "active" | "resolved"; // "active" keeps full details; "resolved" is distilled down to core essence
  updatedAt: number; // Milliseconds timestamp for recency gradient
}

/**
 * Migration helper: loads legacy string[] format and migrates to structured MemoryTopic[]
 */
function loadAndMigrateMemory(): MemoryTopic[] {
  try {
    const rawV2 = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item === "object" && item.topic && item.summary);
      }
    }

    // Attempt legacy migration from v1
    const rawV1 = localStorage.getItem(LEGACY_MEMORY_KEY);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (Array.isArray(parsedV1)) {
        const migrated: MemoryTopic[] = parsedV1
          .filter(Boolean)
          .map((str: string, idx: number) => {
            const cleanStr = String(str).trim();
            // Parse pattern like "[Topic] Summary" or "[Active: Topic] Summary — Detail"
            const activeMatch = cleanStr.match(/^\[Active:\s*([^\]]+)\]\s*([^—]+)(?:—\s*(.+))?$/i);
            if (activeMatch) {
              return {
                id: `mem_${Date.now()}_${idx}`,
                topic: activeMatch[1].trim(),
                summary: activeMatch[2].trim(),
                detail: activeMatch[3] ? activeMatch[3].trim() : undefined,
                status: "active" as const,
                updatedAt: Date.now() - idx * 60000,
              };
            }

            const normalMatch = cleanStr.match(/^\[([^\]]+)\]\s*(.+)$/);
            if (normalMatch) {
              return {
                id: `mem_${Date.now()}_${idx}`,
                topic: normalMatch[1].trim(),
                summary: normalMatch[2].trim(),
                status: "resolved" as const,
                updatedAt: Date.now() - idx * 60000,
              };
            }

            return {
              id: `mem_${Date.now()}_${idx}`,
              topic: "General Context",
              summary: cleanStr,
              status: "active" as const,
              updatedAt: Date.now() - idx * 60000,
            };
          });

        if (migrated.length > 0) {
          localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function getMemoryTopics(): MemoryTopic[] {
  const topics = loadAndMigrateMemory();
  // Sort by updatedAt descending (recency gradient)
  return topics.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveMemoryTopics(topics: MemoryTopic[]): MemoryTopic[] {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(topics));
    window.dispatchEvent(new CustomEvent("dai:memory-updated", { detail: topics }));
    return topics;
  } catch {
    return topics;
  }
}

/**
 * Backwards-compatible string array representation for UI badges and standard lists.
 */
export function getMemory(): string[] {
  const topics = getMemoryTopics();
  return topics.map((t) => {
    if (t.status === "active" && t.detail) {
      return `[Active: ${t.topic}] ${t.summary} — ${t.detail}`;
    }
    return `[${t.topic}] ${t.summary}`;
  });
}

/**
 * Intelligent Partner Memory: Add or update context.
 * If a matching topic already exists, merges the insight, refreshes detail, and bumps recency.
 */
export function addOrUpdateMemory(
  topic: string,
  summary: string,
  detail?: string,
  status: "active" | "resolved" = "active",
): MemoryTopic[] {
  const cleanTopic = (topic || "Context").trim();
  const cleanSummary = (summary || "").trim();
  const cleanDetail = detail?.trim();
  if (!cleanSummary) return getMemoryTopics();

  const current = getMemoryTopics();
  const lowerTopic = cleanTopic.toLowerCase();

  const existingIdx = current.findIndex(
    (t) =>
      t.topic.toLowerCase() === lowerTopic ||
      t.topic.toLowerCase().includes(lowerTopic) ||
      lowerTopic.includes(t.topic.toLowerCase()),
  );

  let updated: MemoryTopic[];
  if (existingIdx !== -1) {
    const existing = current[existingIdx];
    const merged: MemoryTopic = {
      ...existing,
      topic: cleanTopic.length > existing.topic.length ? cleanTopic : existing.topic,
      summary: cleanSummary,
      detail: cleanDetail || existing.detail,
      status,
      updatedAt: Date.now(),
    };
    updated = [merged, ...current.filter((_, idx) => idx !== existingIdx)];
  } else {
    const newEntry: MemoryTopic = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      topic: cleanTopic,
      summary: cleanSummary,
      detail: cleanDetail,
      status,
      updatedAt: Date.now(),
    };
    updated = [newEntry, ...current];
  }

  return saveMemoryTopics(updated);
}

/**
 * Marks a topic resolved or closed: compresses details into distilled summary.
 */
export function closeMemoryTopic(topicOrId: string): MemoryTopic[] {
  if (!topicOrId) return getMemoryTopics();
  const query = topicOrId.toLowerCase().trim();
  const current = getMemoryTopics();

  const updated = current.map((item) => {
    if (item.id === topicOrId || item.topic.toLowerCase().includes(query)) {
      return {
        ...item,
        status: "resolved" as const,
        updatedAt: Date.now(),
      };
    }
    return item;
  });

  return saveMemoryTopics(updated);
}

/**
 * Backwards-compatible helper for adding a freeform fact string.
 */
export function addMemoryFact(fact: string): string[] {
  if (!fact || typeof fact !== "string") return getMemory();
  const trimmed = fact.trim();
  if (!trimmed) return getMemory();

  // Try extracting topic if structured like "[Topic] Summary" or "Topic: Summary"
  const colonMatch = trimmed.match(/^\[?([^:\]]+)\]?:\s*(.+)$/);
  if (colonMatch) {
    addOrUpdateMemory(colonMatch[1], colonMatch[2], undefined, "active");
  } else {
    // Derive a concise domain
    let topic = "User Context";
    const lower = trimmed.toLowerCase();
    if (lower.includes("stack") || lower.includes("typescript") || lower.includes("react") || lower.includes("code")) {
      topic = "Engineering Stack";
    } else if (lower.includes("name") || lower.includes("i am") || lower.includes("call me")) {
      topic = "Identity";
    } else if (lower.includes("design") || lower.includes("aesthetic") || lower.includes("ui")) {
      topic = "Design Aesthetic";
    }
    addOrUpdateMemory(topic, trimmed, undefined, "active");
  }
  return getMemory();
}

export function removeMemoryFact(index: number): string[] {
  const current = getMemoryTopics();
  if (index >= 0 && index < current.length) {
    const updated = current.filter((_, idx) => idx !== index);
    saveMemoryTopics(updated);
  }
  return getMemory();
}

export function clearMemory(): void {
  saveMemoryTopics([]);
}

/**
 * Meticulously blends partner memory into the system prompt.
 * Strictly mandates that the LLM NEVER parrots, announces, or recites memory,
 * allowing it to silently guide tone, depth, and decisions.
 */
export function formatMemoryForSystemPrompt(): string {
  const topics = getMemoryTopics();
  if (topics.length === 0) return "";

  // Active or recently updated topics (within top 4) get detailed granularity
  const activeOrRecent = topics.filter((t) => t.status === "active" || Date.now() - t.updatedAt < 86400000).slice(0, 4);
  const distilled = topics.filter((t) => !activeOrRecent.includes(t)).slice(0, 4);

  let prompt = `## Silent Intellectual Partnership (Implicit Continuity)
You maintain persistent intellectual continuity with the user across conversations.

### Active Working Context & Focus:
${activeOrRecent
  .map(
    (t) =>
      `• [${t.topic}] ${t.summary}${t.detail ? ` (Active Nuance: ${t.detail})` : ""}`,
  )
  .join("\n")}`;

  if (distilled.length > 0) {
    prompt += `\n\n### Distilled Foundations:
${distilled.map((t) => `• [${t.topic}] ${t.summary}`).join("\n")}`;
  }

  prompt += `\n\nCRITICAL PARTNER DIRECTIVES (MANDATORY):
- NEVER recite, announce, list, or quote these notes unless the user explicitly asks what you remember or asks about their profile.
- DO NOT start responses with robotic references like "As you mentioned...", "Hello Dhairya, since you are using...", etc.
- Chats are simply a clean space for the user to organize thoughts. Let your knowledge blend silently into the depth, tone, and technical precision of your work.`;

  return prompt;
}

export type PromptSuggestion = {
  preview: string; // Strictly 4-5 words shown in the ornate box
  prompt: string; // The rich, full prompt sent on click (hidden in UI)
  shapeId: number; // Heraldic shape ID for StretchFrame
};

/**
 * Normalizes text to strictly 4 to 5 words for elegant display inside ornate boxes.
 */
function toStrictFourToFiveWords(text: string): string {
  const cleaned = text
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (cleaned.length === 0) return "Explore Sovereign Intelligence Framework";
  if (cleaned.length < 4) {
    const fillers = ["Architecture", "System", "Dynamics", "Synthesis"];
    for (const f of fillers) {
      if (cleaned.length >= 4) break;
      if (!cleaned.includes(f)) cleaned.push(f);
    }
  }
  return cleaned.slice(0, 5).join(" ");
}

/**
 * Derives prompt suggestions dynamically from user memory and history.
 * - Display: Short 4-5 word preview inside ornate box
 * - Hidden: Full rich prompt sent immediately on click
 * - Blank if no history or memory exists
 */
export function derivePromptSuggestions(
  conversations: Array<{ title?: string }>,
  topics: MemoryTopic[] = getMemoryTopics(),
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  const seenPrompts = new Set<string>();
  const seenPreviews = new Set<string>();

  const heraldicShapes = [1, 2, 4, 8];

  // 1. Suggestions from Active & Distilled Memory Topics
  topics.slice(0, 3).forEach((item, idx) => {
    const lowerTopic = item.topic.toLowerCase();
    const lowerSummary = item.summary.toLowerCase();

    let preview = "";
    let prompt = "";

    if (
      lowerTopic.includes("stack") ||
      lowerTopic.includes("react") ||
      lowerTopic.includes("typescript") ||
      lowerSummary.includes("react") ||
      lowerSummary.includes("code")
    ) {
      preview = "Architect Scalable React Architecture";
      prompt = `Synthesize an elegant, production-grade architectural design for our application stack (${item.summary}), detailing state boundaries and component composition.`;
    } else if (
      lowerTopic.includes("math") ||
      lowerTopic.includes("quantum") ||
      lowerTopic.includes("physics") ||
      lowerSummary.includes("hamiltonian") ||
      lowerSummary.includes("equation")
    ) {
      preview = "Explore Invariant Hamiltonian Systems";
      prompt = `Examine the mathematical formulation of invariant Hamiltonian dynamical systems, outlining symmetries, conservation laws, and geometric invariants.`;
    } else if (
      lowerTopic.includes("harness") ||
      lowerTopic.includes("agent") ||
      lowerTopic.includes("intelligence")
    ) {
      preview = "Design Autonomous Agent Harness";
      prompt = `Formulate a robust execution harness architecture for sovereign agentic AI, covering multi-turn tool loops, sandboxed reflection, and verification.`;
    } else {
      preview = toStrictFourToFiveWords(`Deepen Focus On ${item.topic}`);
      prompt = `Let us deepen our work on ${item.topic}. Considering our context (${item.summary}), outline high-impact next steps and strategic considerations.`;
    }

    const strictlyFourFive = toStrictFourToFiveWords(preview);
    const normKey = strictlyFourFive.toLowerCase();
    if (!seenPrompts.has(prompt) && !seenPreviews.has(normKey)) {
      seenPrompts.add(prompt);
      seenPreviews.add(normKey);
      suggestions.push({
        preview: strictlyFourFive,
        prompt,
        shapeId: heraldicShapes[idx % heraldicShapes.length],
      });
    }
  });

  // 2. Suggestions from Recent Non-Trivial Conversations
  conversations.slice(0, 2).forEach((conv, idx) => {
    let t = (conv.title || "").trim();
    const quoteMatch = t.match(/[“"']([^”"']+)[”"']/);
    if (quoteMatch) {
      t = quoteMatch[1].trim();
    }
    t = t.replace(/^(?:let us continue(?: our exploration of)?|can you explain|explain|what is|how to)\s+/i, "");
    if (t && t !== "Untitled" && !t.toLowerCase().includes("line 1:") && !t.startsWith("What are the 3") && !t.startsWith("Architect Scalable")) {
      const preview = toStrictFourToFiveWords(`Explore ${t}`);
      const normKey = preview.toLowerCase();
      const prompt = `Let us continue our exploration of “${t}”. Synthesize actionable strategic next steps and deeper nuances.`;
      if (!seenPrompts.has(prompt) && !seenPreviews.has(normKey)) {
        seenPrompts.add(prompt);
        seenPreviews.add(normKey);
        suggestions.push({
          preview,
          prompt,
          shapeId: heraldicShapes[(idx + 2) % heraldicShapes.length],
        });
      }
    }
  });

  // Cap at 4 most relevant suggestions; blank if no memory or conversation exists
  return suggestions.slice(0, 4);
}
