import { createClient, type User, type Session } from "@supabase/supabase-js";

const SUPABASE_URL =
  (typeof window !== "undefined" && (window as unknown as { DVERSE_SUPABASE_URL?: string }).DVERSE_SUPABASE_URL) ||
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL ||
  "https://gmwieijbrrztukqpfwkg.supabase.co";

const SUPABASE_KEY =
  (typeof window !== "undefined" && (window as unknown as { DVERSE_SUPABASE_KEY?: string }).DVERSE_SUPABASE_KEY) ||
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_KEY ||
  "sb_publishable_KX3MYtV84QJJdy9bPDuMEA_V99sLKSE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const PORTAL_ORIGIN =
  (typeof window !== "undefined" && (window as unknown as { DVERSE_PORTAL_ORIGIN?: string }).DVERSE_PORTAL_ORIGIN) ||
  "https://dverse.fun";

export interface DbChat {
  id: string;
  user_id: string;
  title: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * Get the current active session
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[D'Ai Auth] getSession error:", error);
      return null;
    }
    return data.session;
  } catch (err) {
    console.warn("[D'Ai Auth] Failed to fetch session:", err);
    return null;
  }
}

/**
 * Get the current authenticated user
 */
export async function getUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Trigger Google OAuth Sign-in
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    const redirectUrl = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "/";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.warn("[D'Ai Auth] Supabase OAuth error, falling back to DVerse portal:", error);
      if (typeof window !== "undefined") {
        window.location.href = `${PORTAL_ORIGIN}/?dverse_return_to=${encodeURIComponent(redirectUrl)}`;
      }
    } else if (data?.url && typeof window !== "undefined") {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error("[D'Ai Auth] Sign in exception:", err);
    const redirectUrl = typeof window !== "undefined" ? window.location.origin : "/";
    if (typeof window !== "undefined") {
      window.location.href = `${PORTAL_ORIGIN}/?dverse_return_to=${encodeURIComponent(redirectUrl)}`;
    }
  }
}

/**
 * Sign out of active session
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[D'Ai Auth] Sign out error:", err);
  }
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback: (user: User | null, session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null, session);
  });
  return data.subscription;
}

/**
 * Cloud Sync: List saved chats from Supabase
 */
export async function listCloudChats(): Promise<DbChat[]> {
  try {
    const session = await getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
      .from("ai_chats")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("[D'Ai Cloud] listCloudChats error:", error);
      return [];
    }
    return (data as DbChat[]) || [];
  } catch (err) {
    console.warn("[D'Ai Cloud] Failed to list chats:", err);
    return [];
  }
}

/**
 * Cloud Sync: Create a new chat record
 */
export async function createCloudChat(title = "New Chat", metadata: Record<string, unknown> = {}): Promise<DbChat | null> {
  try {
    const session = await getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from("ai_chats")
      .insert({
        user_id: session.user.id,
        title,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.warn("[D'Ai Cloud] createCloudChat error:", error);
      return null;
    }
    return data as DbChat;
  } catch (err) {
    console.warn("[D'Ai Cloud] Failed to create chat:", err);
    return null;
  }
}

/**
 * Cloud Sync: Update chat metadata or title
 */
export async function updateCloudChat(chatId: string, patch: Partial<Pick<DbChat, "title" | "metadata">>): Promise<DbChat | null> {
  try {
    const session = await getSession();
    if (!session?.user || !chatId) return null;

    const { data, error } = await supabase
      .from("ai_chats")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", session.user.id)
      .select()
      .single();

    if (error) {
      console.warn("[D'Ai Cloud] updateCloudChat error:", error);
      return null;
    }
    return data as DbChat;
  } catch (err) {
    console.warn("[D'Ai Cloud] Failed to update chat:", err);
    return null;
  }
}

/**
 * Cloud Sync: Delete a chat
 */
export async function deleteCloudChat(chatId: string): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.user || !chatId) return false;

    // First delete associated messages
    await supabase.from("ai_messages").delete().eq("chat_id", chatId).eq("user_id", session.user.id);
    
    // Then delete chat record
    const { error } = await supabase.from("ai_chats").delete().eq("id", chatId).eq("user_id", session.user.id);
    return !error;
  } catch (err) {
    console.warn("[D'Ai Cloud] Failed to delete chat:", err);
    return false;
  }
}

/**
 * Cloud Sync: Save a message
 */
export async function saveCloudMessage(
  chatId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<DbMessage | null> {
  try {
    const session = await getSession();
    if (!session?.user || !chatId || !content) return null;

    const { data, error } = await supabase
      .from("ai_messages")
      .insert({
        chat_id: chatId,
        user_id: session.user.id,
        role,
        content,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.warn("[D'Ai Cloud] saveCloudMessage error:", error);
      return null;
    }
    return data as DbMessage;
  } catch (err) {
    console.warn("[D'Ai Cloud] Failed to save message:", err);
    return null;
  }
}

/**
 * Cloud Sync: List messages for a specific chat
 */
export async function listCloudMessages(chatId: string): Promise<DbMessage[]> {
  try {
    const session = await getSession();
    if (!session?.user || !chatId) return [];

    const { data, error } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[D'Ai Cloud] listCloudMessages error:", error);
      return [];
    }
    return (data as DbMessage[]) || [];
  } catch (err) {
    console.warn("[D'Ai Cloud] Failed to list messages:", err);
    return [];
  }
}
