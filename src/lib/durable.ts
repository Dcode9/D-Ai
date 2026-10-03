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
    const phase: string = m.phase || "";
    const working = live && (phase ? phase !== "" : !row.content);
    if (m.thinking) {
      steps.push({ id: `${row.id}-t`, type: "thought", durationSec: 0, content: String(m.thinking), isLive: live && !row.content });
    }
    const sources: any[] = Array.isArray(m.sources) ? m.sources : [];
    const tools: any[] = Array.isArray(m.tools) ? m.tools : [];
    let cursor = 0;
    tools.forEach((t: any, i: number) => {
      if (t?.name !== "web_search") return;
      const n = Number(t.results) || 0;
      const results = sources.slice(cursor, cursor + n).map((s) => ({ title: s.title, url: s.url, snippet: s.snippet || "" }));
      cursor += n;
      const pending = live && phase === "searching" && n === 0 && i === tools.length - 1;
      steps.push({ id: `${row.id}-s${i}`, type: "search", query: String(t.query || ""), websitesFound: results.length, results, isLive: pending });
    });
    if (steps.length || working) {
      msg.work = {
        totalDurationSec: 0,
        steps,
        isWorking: working,
        statusText: working ? (phase === "searching" ? "Searching the web…" : phase === "thinking" ? "Thinking…" : tools.length ? "Working…" : "") : "",
      };
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

export type RunEvent =
  | { type: "meta"; message_id: string }
  | { type: "content"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_query"; name: string; query: string }
  | { type: "tool_done"; name: string; query: string; sources: { title: string; url: string; snippet?: string }[] }
  | { type: "app"; app: "tunes" | "quest"; query?: string; play?: boolean }
  | { type: "timing"; first_token_ms: number }
  | { type: "done" }
  | { type: "error"; message?: string };

// Starts a run and streams its events straight from the server (no database hop),
// while the server still saves everything so other devices and later reloads see it.
export async function streamRun(
  chatId: string,
  messages: unknown[],
  extra: Record<string, unknown>,
  onEvent: (e: RunEvent) => void,
  signal?: AbortSignal,
): Promise<{ finished: boolean; messageId: string | null }> {
  const session = await getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  const res = await fetch("/api/run", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ chat_id: chatId, messages, stream_events: true, ...extra }),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Run failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let messageId: string | null = null;
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6)) as RunEvent;
          if (evt.type === "meta") messageId = evt.message_id;
          if (evt.type === "done" || evt.type === "error") finished = true;
          onEvent(evt);
        } catch { /* partial */ }
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    /* connection dropped: caller falls back to the saved row */
  }
  return { finished, messageId };
}
