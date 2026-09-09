export const MEMORY_STORAGE_KEY = "dai_personal_memory_v1";

export function getMemory(): string[] {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveMemory(facts: string[]): string[] {
  try {
    const clean = Array.from(
      new Set(
        (facts || [])
          .map((s) => String(s || "").trim())
          .filter(Boolean),
      ),
    );
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent("dai:memory-updated", { detail: clean }));
    return clean;
  } catch {
    return facts;
  }
}

export function addMemoryFact(fact: string): string[] {
  if (!fact || typeof fact !== "string") return getMemory();
  const trimmed = fact.trim();
  if (!trimmed) return getMemory();
  const current = getMemory();
  if (!current.includes(trimmed)) {
    const updated = [trimmed, ...current];
    return saveMemory(updated);
  }
  return current;
}

export function removeMemoryFact(index: number): string[] {
  const current = getMemory();
  if (index >= 0 && index < current.length) {
    const updated = [...current];
    updated.splice(index, 1);
    return saveMemory(updated);
  }
  return current;
}

export function clearMemory(): void {
  saveMemory([]);
}

export type PromptSuggestion = {
  title: string;
  desc: string;
  prompt: string;
};

/**
 * Derives contextual prompt suggestions based on user history and remembered facts.
 * Returns an empty array if no history or memory exists (keeping the UI blank as requested).
 */
export function derivePromptSuggestions(
  conversations: Array<{ title?: string }>,
  memoryFacts: string[],
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  const seen = new Set<string>();

  // 1. Suggestions from Personal Memory Facts
  memoryFacts.forEach((fact) => {
    const lower = fact.toLowerCase();
    if (lower.includes("name is") || lower.includes("i am") || lower.includes("call me")) {
      const match = fact.match(/(?:name is|i am|call me)\s+([A-Za-z]+)/i);
      const name = match ? match[1] : "Dhairya";
      const p = `Greetings D'Ai. Given my personal profile, what are 3 high-impact strategic ideas tailored for me today?`;
      if (!seen.has(p)) {
        seen.add(p);
        suggestions.push({
          title: `✦ Personalized Strategy`,
          desc: `Strategic insights tailored for ${name}`,
          prompt: p,
        });
      }
    } else if (lower.includes("code") || lower.includes("developer") || lower.includes("program") || lower.includes("typescript") || lower.includes("react") || lower.includes("python")) {
      const p = `Help me architect an elegant and robust software solution based on my development stack: ${fact}`;
      if (!seen.has(p)) {
        seen.add(p);
        suggestions.push({
          title: `⚡ Engineering & Architecture`,
          desc: `Technical architecture aligned with your stack`,
          prompt: p,
        });
      }
    } else {
      const p = `Reflect on my personal context: "${fact}". How can we build or optimize around this?`;
      if (!seen.has(p)) {
        seen.add(p);
        suggestions.push({
          title: `🧠 Contextual Focus`,
          desc: fact.slice(0, 42) + (fact.length > 42 ? "…" : ""),
          prompt: p,
        });
      }
    }
  });

  // 2. Suggestions from Recent Conversation History
  conversations.slice(0, 3).forEach((conv) => {
    const t = (conv.title || "").trim();
    if (t && t !== "Untitled" && !t.startsWith("What are the 3")) {
      const p = `Let us continue our exploration of “${t}”. Elaborate deeper with actionable next steps.`;
      if (!seen.has(p)) {
        seen.add(p);
        suggestions.push({
          title: `↺ Continue Topic`,
          desc: `Expand on “${t.slice(0, 36)}${t.length > 36 ? "…" : ""}”`,
          prompt: p,
        });
      }
    }
  });

  // Cap at 4 most relevant suggestions
  return suggestions.slice(0, 4);
}
