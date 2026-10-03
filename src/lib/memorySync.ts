import { supabase, getSession } from "./supabase";
import { MemoryTopic, getMemoryTopics, saveMemoryTopics } from "./memory";

// Memory follows the account. Stored as one hidden ai_chats row (title MEMORY_TITLE,
// metadata.kind = "memory"), so no schema change is needed. Newer updatedAt wins per topic.
export const MEMORY_TITLE = "__dai_memory__";
const SYNCED_KEY = "dai_memory_synced_at";

let timer: ReturnType<typeof setTimeout> | null = null;
let pulling = false;

async function findRow(userId: string): Promise<{ id: string; metadata?: { topics?: MemoryTopic[] }; updated_at: string } | null> {
  const { data, error } = await supabase
    .from("ai_chats")
    .select("id,metadata,updated_at")
    .eq("user_id", userId)
    .eq("title", MEMORY_TITLE)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return data[0] as any;
}

export async function pushMemoryNow(): Promise<void> {
  try {
    const session = await getSession();
    if (!session?.user) return;
    const topics = getMemoryTopics();
    const row = await findRow(session.user.id);
    const metadata = { kind: "memory", topics };
    if (row) {
      await supabase.from("ai_chats").update({ metadata, updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", session.user.id);
    } else {
      await supabase.from("ai_chats").insert({ user_id: session.user.id, title: MEMORY_TITLE, metadata });
    }
    localStorage.setItem(SYNCED_KEY, String(Date.now()));
  } catch (e) {
    console.warn("[D'Ai memory] push failed", e);
  }
}

export function schedulePush(): void {
  if (pulling) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void pushMemoryNow(), 1500);
}

export async function pullMemory(): Promise<void> {
  if (pulling) return;
  pulling = true;
  try {
    const session = await getSession();
    if (!session?.user) return;
    const row = await findRow(session.user.id);
    const local = getMemoryTopics();
    if (!row) {
      if (local.length) await pushMemoryNow();
      return;
    }
    const remote: MemoryTopic[] = Array.isArray(row.metadata?.topics) ? row.metadata!.topics! : [];
    const lastSync = Number(localStorage.getItem(SYNCED_KEY) || 0);
    const byId = new Map<string, MemoryTopic>();
    for (const t of remote) byId.set(t.id, t);
    for (const t of local) {
      const r = byId.get(t.id);
      if (r) { if (t.updatedAt > r.updatedAt) byId.set(t.id, t); }
      else if (t.updatedAt > lastSync) byId.set(t.id, t); // new here since last sync
      // else: it was deleted on another device
    }
    const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    const changed = JSON.stringify(merged) !== JSON.stringify(local);
    if (changed) saveMemoryTopics(merged, { remote: true });
    const remoteChanged = JSON.stringify([...merged].sort((a, b) => a.id.localeCompare(b.id))) !== JSON.stringify([...remote].sort((a, b) => a.id.localeCompare(b.id)));
    pulling = false;
    if (remoteChanged) await pushMemoryNow();
    else localStorage.setItem(SYNCED_KEY, String(Date.now()));
  } catch (e) {
    console.warn("[D'Ai memory] pull failed", e);
  } finally {
    pulling = false;
  }
}
