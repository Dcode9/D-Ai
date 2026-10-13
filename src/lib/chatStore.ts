import type { Message } from "../hooks/useChat";

export interface Project {
  id: string;
  name: string;
  color?: string; // CSS color or gold/plum/amber accent
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  projectId?: string | null;
  rootId?: string; // ID of the root chat (equals id if root)
  parentId?: string | null; // ID of the parent conversation or branch
  forkMessageIndex?: number; // Index in parent conversation where the fork occurred
  forkMessageId?: string | null; // Message ID in parent where the fork occurred
  messages: Message[];
  preview?: string; // one-line snippet for cloud chats whose messages are not loaded yet
}

export const CHATS_STORAGE_KEY = "dai.conversations.v2";
const LEGACY_STORAGE_KEY = "dai.conversations.v1";
export const PROJECTS_STORAGE_KEY = "dai.projects.v1";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Migration & loading helper for conversations
 */
export function loadStoredConversations(): Conversation[] {
  try {
    const rawV2 = localStorage.getItem(CHATS_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => ({
          ...c,
          rootId: c.rootId || c.id,
          parentId: c.parentId || null,
          forkMessageIndex: typeof c.forkMessageIndex === "number" ? c.forkMessageIndex : undefined,
          pinned: Boolean(c.pinned),
          projectId: c.projectId || null,
          updatedAt: c.updatedAt || c.createdAt || Date.now(),
        }));
      }
    }

    // Attempt migration from v1
    const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (Array.isArray(parsedV1)) {
        const migrated: Conversation[] = parsedV1.map((c: any) => ({
          id: c.id || uid(),
          title: c.title || "Untitled",
          createdAt: c.createdAt || Date.now(),
          updatedAt: c.createdAt || Date.now(),
          pinned: false,
          projectId: null,
          rootId: c.id,
          parentId: null,
          messages: Array.isArray(c.messages) ? c.messages : [],
        }));
        localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    return [];
  } catch (e) {
    console.warn("[chatStore] Failed to load conversations:", e);
    return [];
  }
}

export function saveStoredConversations(chats: Conversation[]): Conversation[] {
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats.slice(0, 100)));
    window.dispatchEvent(new CustomEvent("dai:chats-updated", { detail: chats }));
    return chats;
  } catch (e) {
    // Out of space: drop old inline images (keep the 3 newest chats' pictures) and retry.
    try {
      const slim = JSON.stringify(chats.slice(0, 100), (_k, v) => (typeof v === "string" && v.startsWith("data:image") ? "" : v));
      const keep = JSON.parse(slim) as Conversation[];
      const merged = keep.map((c, idx) => (idx < 3 ? chats[idx] : c));
      localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(merged));
      return chats;
    } catch { /* fall through */ }
    console.warn("[chatStore] Failed to save conversations:", e);
    return chats;
  }
}

export function loadStoredProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStoredProjects(projects: Project[]): Project[] {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    window.dispatchEvent(new CustomEvent("dai:projects-updated", { detail: projects }));
    return projects;
  } catch {
    return projects;
  }
}

/**
 * RECURSIVE CONTEXT RESOLUTION FOR BRANCHING:
 * Resolves the complete lineage of messages for a branch.
 * If activeChatId is Branch 2.1:
 * Traces: Initial Chat (up to fork point) -> Branch 2 (up to fork point) -> Branch 2.1 (all messages).
 * Returns the merged chronological message array.
 */
export function getResolvedBranchMessages(activeChatId: string, allChats: Conversation[]): Message[] {
  const chatMap = new Map(allChats.map((c) => [c.id, c]));
  const target = chatMap.get(activeChatId);
  if (!target) return [];

  // If chat has no parent, it is the root chat; return its own messages
  if (!target.parentId) {
    return target.messages;
  }

  // Build the ancestor chain from root down to target
  const chain: Conversation[] = [];
  const visited = new Set<string>();
  let current: Conversation | undefined = target;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    if (current.parentId) {
      current = chatMap.get(current.parentId);
    } else {
      break;
    }
  }

  // Assemble messages along the chain
  let assembled: Message[] = [];

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i];
    const isLeaf = i === chain.length - 1;

    if (isLeaf) {
      // For the active branch leaf, include all of its messages
      assembled = [...assembled, ...node.messages];
    } else {
      // For an ancestor node, include messages up to the child's fork point
      const nextChild = chain[i + 1];
      const forkIdx =
        typeof nextChild.forkMessageIndex === "number"
          ? nextChild.forkMessageIndex + 1
          : nextChild.forkMessageId
            ? node.messages.findIndex((m) => m.id === nextChild.forkMessageId) + 1
            : node.messages.length;

      const inherited = node.messages.slice(0, forkIdx > 0 ? forkIdx : node.messages.length);
      assembled = [...assembled, ...inherited];
    }
  }

  return assembled;
}

/**
 * Retrieves the breadcrumb path of ancestors for a branch:
 * e.g., [{ id, title }, ...] from root down to active branch.
 */
export function getBranchBreadcrumb(
  activeChatId: string,
  allChats: Conversation[],
): Array<{ id: string; title: string }> {
  const chatMap = new Map(allChats.map((c) => [c.id, c]));
  const target = chatMap.get(activeChatId);
  if (!target) return [];

  const crumbs: Array<{ id: string; title: string }> = [];
  const visited = new Set<string>();
  let current: Conversation | undefined = target;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    crumbs.unshift({ id: current.id, title: current.title });
    if (current.parentId) {
      current = chatMap.get(current.parentId);
    } else {
      break;
    }
  }
  return crumbs;
}

/**
 * Gets all sibling branches sharing the same parent as activeChatId
 */
export function getSiblingBranches(
  activeChatId: string,
  allChats: Conversation[],
): Array<{ id: string; title: string; isCurrent: boolean }> {
  const chatMap = new Map(allChats.map((c) => [c.id, c]));
  const target = chatMap.get(activeChatId);
  if (!target) return [];

  const parentId = target.parentId;
  if (!parentId) {
    // Top-level / root chat: siblings are other roots
    return allChats
      .filter((c) => !c.parentId && c.id !== target.id)
      .slice(0, 5)
      .map((c) => ({ id: c.id, title: c.title, isCurrent: false }));
  }

  return allChats
    .filter((c) => c.parentId === parentId)
    .map((c) => ({ id: c.id, title: c.title, isCurrent: c.id === activeChatId }));
}

/**
 * Creates a branch from a source conversation at an optional message index/id.
 */
export function createBranchConversation(
  sourceChatId: string,
  allChats: Conversation[],
  messageIdOrIndex?: string | number,
  customTitle?: string,
): { newChat: Conversation; updatedChats: Conversation[] } {
  const chatMap = new Map(allChats.map((c) => [c.id, c]));
  const source = chatMap.get(sourceChatId);
  if (!source) {
    throw new Error(`Source conversation ${sourceChatId} not found`);
  }

  // Count existing branches from this parent to compute default branch name
  const existingBranches = allChats.filter((c) => c.parentId === sourceChatId);
  const branchNum = existingBranches.length + 1;

  let forkIdx = source.messages.length - 1;
  let forkId: string | null = null;

  if (typeof messageIdOrIndex === "number") {
    forkIdx = Math.max(0, Math.min(messageIdOrIndex, source.messages.length - 1));
    forkId = source.messages[forkIdx]?.id || null;
  } else if (typeof messageIdOrIndex === "string") {
    const foundIdx = source.messages.findIndex((m) => m.id === messageIdOrIndex);
    if (foundIdx !== -1) {
      forkIdx = foundIdx;
      forkId = messageIdOrIndex;
    }
  }

  // Derive branch name: "Branch [Parent].[branchNum]" or "Branch [branchNum]"
  const basePrefix = source.parentId ? source.title.replace(/^Branch\s*/i, "") : "";
  const derivedTitle = customTitle || (basePrefix ? `Branch ${basePrefix}.${branchNum}` : `Branch ${branchNum}`);

  const newChat: Conversation = {
    id: `conv_${uid()}`,
    title: derivedTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    projectId: source.projectId || null,
    rootId: source.rootId || source.id,
    parentId: source.id,
    forkMessageIndex: forkIdx,
    forkMessageId: forkId,
    messages: [], // Starts with clean branch-specific messages, inheriting ancestors dynamically
  };

  const updatedChats = [newChat, ...allChats];
  saveStoredConversations(updatedChats);
  return { newChat, updatedChats };
}

/**
 * Calculates how many messages are inherited from ancestors for a given conversation.
 */
export function getBranchAncestorCount(activeChatId: string, allChats: Conversation[]): number {
  const chatMap = new Map(allChats.map((c) => [c.id, c]));
  const target = chatMap.get(activeChatId);
  if (!target || !target.parentId) return 0;

  const resolved = getResolvedBranchMessages(activeChatId, allChats);
  return Math.max(0, resolved.length - target.messages.length);
}

/**
 * Deletes a conversation and cascades to all its descendants recursively.
 */
export function deleteConversationWithDescendants(
  chatIdToDelete: string,
  allChats: Conversation[],
): { remainingChats: Conversation[]; deletedIds: string[] } {
  const toDelete = new Set<string>([chatIdToDelete]);
  let added = true;

  while (added) {
    added = false;
    for (const c of allChats) {
      if (c.parentId && toDelete.has(c.parentId) && !toDelete.has(c.id)) {
        toDelete.add(c.id);
        added = true;
      }
    }
  }

  const remainingChats = allChats.filter((c) => !toDelete.has(c.id));
  saveStoredConversations(remainingChats);
  return { remainingChats, deletedIds: Array.from(toDelete) };
}

/** Picks the image model from the prompt: fast Z-Image Turbo by default, GPT Image 2 only for really complex asks. */
export function pickImageModel(prompt: string): "gpt-image-2" | "" {
  const p = (prompt || "").trim();
  const words = p.split(/\s+/).filter(Boolean).length;
  const needsText = /\b(text|typograph|lettering|caption|title|headline|slogan|words?\s+(saying|that say)|says?|reads?|poster|infographic|logo|menu|book cover|magazine|banner|sign(?:age)?|label|diagram|chart|ui mockup|screenshot|comic|storyboard|meme)\b/i.test(p) || /["“”][^"“”]{2,}["“”]/.test(p);
  const manySubjects = /\b(collage|grid of|set of|series of|multiple|several|crowd|group of|\d+\s+(people|characters|panels|items|objects))\b/i.test(p);
  const exacting = /\b(photorealistic|hyper[- ]?realistic|ultra[- ]?detailed|8k|product shot|studio photo|accurate|exact|precise|infographic|technical drawing|blueprint)\b/i.test(p);
  const complex = (words >= 40) || (needsText && words >= 6) || manySubjects || (exacting && words >= 14);
  return complex ? "gpt-image-2" : "";
}

/** Shrinks a generated image to a small JPEG data URL so it survives reloads and cloud sync. */
export async function shrinkToDataUrl(blob: Blob, max = 960, quality = 0.82): Promise<string> {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } catch {
    return await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ""));
      r.onerror = () => res("");
      r.readAsDataURL(blob);
    });
  }
}
