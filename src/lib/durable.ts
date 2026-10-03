// Client side of durable chat runs: the server keeps generating after this tab
// closes and writes the growing answer into ai_messages; every device reads it.
import type { Message, WorkStep, Mode } from "../hooks/useChat";
import { supabase, getSession } from "./supabase";

export type DbRow = {
  id: string;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, any> | null;
  created_at?: string;
};

export const isUuid = (s: string | null | undefined) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

const STALE_RUN_MS = 6 * 60 * 1000;

export function isRunLive(row: DbRow): boolean {
  const m = row.metadata || {};
  if (m.status !== "streaming") return false;
  const t = Date.parse(m.updated_at || m.started_at || row.created_at || "");
  return Number.isFinite(t) ? Date.now() - t < STALE_RUN_MS : true;
}

export function rowToMessage(row: DbRow): Message | null {
  if (row.role !== "user" && row.role !== "assistant") return null;
  const m = row.metadata || {};
  const live = row.role === "assistant" && isRunLive(row);
  const msg: Message = {
    id: row.id,
    role: row.role,
    content: row.content || "",
    mode: (m.mode as Mode) || null,
    streaming: live,
  };
  if (row.role === "assistant") {
    const steps: WorkStep[] = [];
    if (m.thinking) {
      steps.push({ id: `${row.id}-t`, type: "thought", durationSec: 0, content: String(m.thinking), isLive: live });
    }
    const sources: any[] = Array.isArray(m.sources) ? m.sources : [];
    let cursor = 0;
    (Array.isArray(m.tools) ? m.tools : []).forEach((t: any, i: number) => {
      if (t?.name !== "web_search") return;
      const n = Number(t.results) || 0;
      const results = sources.slice(cursor, cursor + n).map((s) => ({ title: s.title, url: s.url, snippet: s.snippet || "" }));
      cursor += n;
      steps.push({ id: `${row.id}-s${i}`, type: "search", query: String(t.query || ""), websitesFound: results.length, results });
    });
    if (steps.length || live) {
      msg.work = { totalDurationSec: 0, steps, isWorking: live, statusText: live ? (m.tools?.length ? "Working…" : "") : "" };
    }
    if (m.status === "error" && !row.content) msg.content = "Something went wrong while generating this reply.";
  }
  return msg;
}

export async function ensureCloudChat(id: string, title: string, userId: string) {
  const { data } = await supabase.from("ai_chats").select("id").eq("id", id).maybeSingle();
  if (data) return;
  await supabase.from("ai_chats").insert({ id, user_id: userId, title, metadata: {} });
}

export async function insertUserRow(id: string, chatId: string, userId: string, content: string, mode: Mode | null) {
  const { error } = await supabase
    .from("ai_messages")
    .insert({ id, chat_id: chatId, user_id: userId, role: "user", content, metadata: mode ? { mode } : {} });
  if (error) throw error;
}

export async function startRun(chatId: string, messages: unknown[], extra: Record<string, unknown>) {
  const session = await getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ chat_id: chatId, messages, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Run failed (${res.status})`);
  return data as { message_id: string; status: string };
}

export async function fetchRow(id: string): Promise<DbRow | null> {
  const { data } = await supabase.from("ai_messages").select("*").eq("id", id).maybeSingle();
  return (data as DbRow) || null;
}

export async function loadChatMessages(chatId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  return ((data as DbRow[]) || []).map(rowToMessage).filter((m): m is Message => !!m);
}

// Live feed of every message change for this user (all devices, all chats).
export function subscribeMessages(userId: string, onRow: (row: DbRow) => void, onChat: (row: any) => void) {
  const ch = supabase
    .channel(`dai-sync-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "ai_messages", filter: `user_id=eq.${userId}` }, (p: any) => {
      if (p.new && p.new.id) onRow(p.new as DbRow);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "ai_chats", filter: `user_id=eq.${userId}` }, (p: any) => {
      if (p.new && p.new.id) onChat(p.new);
    })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
