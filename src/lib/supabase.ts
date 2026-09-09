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

function base64UrlDecode(str: string): Record<string, unknown> | null {
  try {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    console.warn("[D'Ai Auth] Failed to decode session handoff:", e);
    return null;
  }
}

let checkedUrlHandoff = false;

/**
 * Check and restore session handoff from URL query (?dverse_session) or hash (#dverse_session or #access_token)
 */
export async function restoreSessionFromUrl(): Promise<Session | null> {
  if (checkedUrlHandoff || typeof window === "undefined") return null;
  checkedUrlHandoff = true;

  try {
    let sessionData: { access_token?: string; refresh_token?: string } | null = null;

    // 1. Check ?dverse_session=... in query
    const searchParams = new URLSearchParams(window.location.search);
    const searchSession = searchParams.get("dverse_session");
    if (searchSession) {
      searchParams.delete("dverse_session");
      const cleanSearch = searchParams.toString();
      const cleanUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${window.location.hash}`;
      try { window.history.replaceState({}, document.title, cleanUrl); } catch (_) {}
      sessionData = base64UrlDecode(searchSession) as { access_token?: string; refresh_token?: string } | null;
    }

    // 2. Check #dverse_session=... in hash
    if (!sessionData && window.location.hash && window.location.hash.includes("dverse_session=")) {
      const hashText = window.location.hash.slice(1);
      const params = new URLSearchParams(hashText.startsWith("?") ? hashText.slice(1) : hashText);
      const hashSession = params.get("dverse_session");
      params.delete("dverse_session");
      const cleanHash = params.toString();
      const cleanUrl = `${window.location.pathname}${window.location.search}${cleanHash ? `#${cleanHash}` : ""}`;
      try { window.history.replaceState({}, document.title, cleanUrl); } catch (_) {}
      if (hashSession) {
        sessionData = base64UrlDecode(hashSession) as { access_token?: string; refresh_token?: string } | null;
      }
    }

    // 3. Check standard Supabase OAuth hash: #access_token=...&refresh_token=...
    if (!sessionData && window.location.hash && (window.location.hash.includes("access_token=") || window.location.hash.includes("refresh_token="))) {
      const hashText = window.location.hash.slice(1);
      const params = new URLSearchParams(hashText.startsWith("?") ? hashText.slice(1) : hashText);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        sessionData = { access_token: accessToken, refresh_token: refreshToken };
        try {
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        } catch (_) {}
      }
    }

    if (sessionData?.access_token && sessionData?.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });
      if (error) {
        console.warn("[D'Ai Auth] Failed to restore session from handoff:", error);
      } else if (data?.session) {
        return data.session;
      }
    }
  } catch (err) {
    console.warn("[D'Ai Auth] Error during session handoff restoration:", err);
  }

  return null;
}

function setReturnCookie(url?: string) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const target = url || window.location.origin + window.location.pathname;
  document.cookie = `dverse.auth.returnTo=${encodeURIComponent(target)}; domain=.d-verse.in; path=/; max-age=600; SameSite=Lax; Secure`;
  document.cookie = `dverse_auth_return_to=${encodeURIComponent(target)}; domain=.d-verse.in; path=/; max-age=600; SameSite=Lax; Secure`;
  try {
    localStorage.setItem("dverse.auth.returnTo", target);
    sessionStorage.setItem("dverse.auth.returnTo", target);
  } catch (_) {}
}

function clearReturnCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "dverse.auth.returnTo=; domain=.d-verse.in; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure";
  document.cookie = "dverse_auth_return_to=; domain=.d-verse.in; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure";
  try {
    localStorage.removeItem("dverse.auth.returnTo");
    sessionStorage.removeItem("dverse.auth.returnTo");
  } catch (_) {}
}

/**
 * Get the current active session
 */
export async function getSession(): Promise<Session | null> {
  try {
    const handoff = await restoreSessionFromUrl();
    if (handoff) return handoff;

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
  const redirectUrl = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "/";
  setReturnCookie(redirectUrl);

  try {
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
      console.warn("[D'Ai Auth] Direct Supabase OAuth error, falling back to central portal:", error);
      if (typeof window !== "undefined") {
        window.location.href = `https://d-verse.in/?dverse_return_to=${encodeURIComponent(redirectUrl)}`;
      }
    } else if (data?.url && typeof window !== "undefined") {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error("[D'Ai Auth] Sign in exception, falling back to portal:", err);
    if (typeof window !== "undefined") {
      window.location.href = `https://d-verse.in/?dverse_return_to=${encodeURIComponent(redirectUrl)}`;
    }
  }
}

/**
 * Sign out of active session
 */
export async function signOut(): Promise<void> {
  try {
    clearReturnCookie();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[D'Ai Auth] Sign out error:", err);
  }
}

export interface DverseProfile {
  id: string;
  dverse_id: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * Check if a D'Verse ID handle is available
 */
export async function isDverseIdAvailable(dverseId: string): Promise<boolean> {
  try {
    let clean = dverseId.trim();
    if (clean.startsWith("@")) clean = clean.slice(1);
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(clean)) return false;
    const { data, error } = await supabase.rpc("is_dverse_id_available", {
      p_dverse_id: clean,
    });
    if (error) return true;
    return !!data;
  } catch {
    return true;
  }
}

/**
 * Register a new D'Verse ID account
 */
export async function signUpWithDverseId({
  dverseId,
  email,
  password,
  displayName,
}: {
  dverseId: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ user: User | null; session: Session | null }> {
  let cleanId = dverseId.trim().toLowerCase();
  if (cleanId.startsWith("@")) cleanId = cleanId.slice(1);

  if (!/^[a-z0-9_]{3,24}$/.test(cleanId)) {
    throw new Error("D'Verse ID must be 3–24 characters and contain only letters, numbers, or underscores.");
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    throw new Error("Please provide a valid email address.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const available = await isDverseIdAvailable(cleanId);
  if (!available) {
    throw new Error(`The D'Verse ID "@${cleanId}" is already taken. Please choose another.`);
  }

  const name = displayName?.trim() || cleanId;

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        dverse_id: cleanId,
        display_name: name,
        full_name: name,
      },
    },
  });

  if (error) {
    if (error.message.includes("already registered") || error.message.includes("User already exists")) {
      throw new Error("An account with this email already exists. Try signing in instead.");
    }
    throw error;
  }

  return { user: data.user, session: data.session };
}

/**
 * Sign in using D'Verse ID handle or Email address
 */
export async function signInWithDverseId({
  identifier,
  password,
}: {
  identifier: string;
  password: string;
}): Promise<{ user: User | null; session: Session | null }> {
  let target = identifier.trim();
  if (target.startsWith("@")) target = target.slice(1);

  if (!target) {
    throw new Error("Please enter your D'Verse ID or email address.");
  }
  if (!password) {
    throw new Error("Please enter your password.");
  }

  let loginEmail = target;

  // If not in email format, resolve D'Verse ID to email
  if (!target.includes("@")) {
    const { data: resolved, error: rpcError } = await supabase.rpc("resolve_dverse_login", {
      p_identifier: target.toLowerCase(),
    });
    if (rpcError || !resolved || !resolved.includes("@")) {
      throw new Error(`D'Verse ID "@${target}" was not found. Please verify your handle or create an account.`);
    }
    loginEmail = resolved;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail.toLowerCase(),
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
      throw new Error("Incorrect D'Verse ID / email or password.");
    }
    throw error;
  }

  return { user: data.user, session: data.session };
}

/**
 * Fetch full D'Verse profile including dverse_id
 */
export async function getDverseProfile(userId?: string): Promise<DverseProfile | null> {
  try {
    const id = userId || (await getUser())?.id;
    if (!id) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, dverse_id, display_name, email, avatar_url")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return data as DverseProfile;
  } catch {
    return null;
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
