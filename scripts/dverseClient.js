(function () {
  const SUPABASE_URL = window.DVERSE_SUPABASE_URL || 'https://gmwieijbrrztukqpfwkg.supabase.co';
  const SUPABASE_KEY = window.DVERSE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtd2llaWpicnJ6dHVrcXBmd2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzcyMDAsImV4cCI6MjA5Njc1MzIwMH0.yPVyvYH3g1TBCb65S86USa6_dNNactQb-bNLKWxcf3w';
  const ready = Boolean(window.supabase && SUPABASE_URL && SUPABASE_KEY);
  const client = ready ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }) : null;
  const PORTAL_ORIGIN = (window.DVERSE_PORTAL_ORIGIN || 'https://dverse.fun').replace(/\/$/, '');
  const AUTH_BRIDGE_URL = `${PORTAL_ORIGIN}/auth-bridge.html`;
  const authRedirectUrl = () => `${window.location.origin}/`;
  let portalSessionPromise = null;

  function bridgeRequest(message, timeoutMs = 2500) {
    if (!PORTAL_ORIGIN || window.location.origin === PORTAL_ORIGIN || typeof document === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const frame = document.createElement('iframe');
      let finished = false;

      function cleanup(value) {
        if (finished) return;
        finished = true;
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        try { frame.remove(); } catch (e) {}
        resolve(value);
      }

      function onMessage(event) {
        if (event.origin !== PORTAL_ORIGIN) return;
        const data = event.data || {};
        if (data.source !== 'dverse-auth-bridge' || data.requestId !== requestId) return;
        cleanup(data);
      }

      const timer = setTimeout(() => cleanup(null), timeoutMs);
      frame.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
      frame.setAttribute('aria-hidden', 'true');
      frame.addEventListener('load', () => {
        frame.contentWindow?.postMessage({
          source: 'dverse-app',
          requestId,
          ...message
        }, PORTAL_ORIGIN);
      });
      window.addEventListener('message', onMessage);
      frame.src = AUTH_BRIDGE_URL;
      (document.body || document.documentElement).appendChild(frame);
    });
  }

  async function bootstrapFromPortal() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;

    if (!portalSessionPromise) {
      portalSessionPromise = (async () => {
        const response = await bridgeRequest({ type: 'dverse-auth:get-session' });
        const session = response?.session;
        if (!session?.access_token || !session?.refresh_token) return null;
        const { data: restored, error: restoreError } = await client.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        if (restoreError) throw restoreError;
        return restored.session || null;
      })().catch((e) => {
        console.warn('[DVerse] Bridge session check failed:', e);
        return null;
      }).finally(() => {
        portalSessionPromise = null;
      });
    }
    return portalSessionPromise;
  }

  function syncSessionToPortal(session) {
    if (!session?.access_token || !session?.refresh_token) return;
    bridgeRequest({
      type: 'dverse-auth:set-session',
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token
      }
    }, 1500).catch((error) => console.warn('[DVerse] Portal session sync failed:', error));
  }

  async function getSession() {
    if (!client) return null;
    return bootstrapFromPortal();
  }

  function onAuthStateChange(callback) {
    if (!client || typeof callback !== 'function') return { unsubscribe() {} };
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        syncSessionToPortal(session);
      }
      callback(event, session);
    });
    return data.subscription;
  }

  async function signInWithGoogle() {
    if (!client) throw new Error("D'Verse Supabase client is not configured.");
    const isIframe = window !== window.top;
    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authRedirectUrl(),
          skipBrowserRedirect: isIframe
        }
      });
      if (error) throw error;
      if (data?.url) {
        if (isIframe) {
          window.open(data.url, '_blank');
        } else {
          window.location.href = data.url;
        }
      }
    } catch (e) {
      console.warn('[DVerse] Direct OAuth failed, attempting portal redirect fallback:', e);
      const targetUrl = `${PORTAL_ORIGIN}/?dverse_return_to=${encodeURIComponent(authRedirectUrl())}`;
      if (isIframe) {
        window.open(targetUrl, '_blank');
      } else {
        window.location.href = targetUrl;
      }
    }
  }

  async function signOut() {
    if (!client) return;
    try {
      const { error } = await client.auth.signOut();
      if (error) console.warn('[DVerse] Supabase sign-out error:', error);
    } catch (e) {
      console.warn('[DVerse] Sign-out exception:', e);
    }
    await bridgeRequest({ type: 'dverse-auth:sign-out' }, 1500).catch(() => {});
  }

  async function createChat(title = 'New chat', metadata = {}) {
    const session = await getSession();
    if (!client || !session) return null;
    const { data, error } = await client
      .from('ai_chats')
      .insert({ user_id: session.user.id, title, metadata })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateChat(chatId, patch = {}) {
    const session = await getSession();
    if (!client || !session || !chatId) return null;
    const { data, error } = await client
      .from('ai_chats')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .eq('user_id', session.user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function saveMessage(chatId, role, content, metadata = {}) {
    const session = await getSession();
    if (!client || !session || !chatId || !content) return null;
    const { data, error } = await client
      .from('ai_messages')
      .insert({ chat_id: chatId, user_id: session.user.id, role, content, metadata })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function listChats() {
    const session = await getSession();
    if (!client || !session) return [];
    const { data, error } = await client
      .from('ai_chats')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function listMessages(chatId) {
    const session = await getSession();
    if (!client || !session || !chatId) return [];
    const { data, error } = await client
      .from('ai_messages')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  window.dverse = {
    ...(window.dverse || {}),
    supabase: client,
    isConfigured: ready,
    getSession,
    bootstrapFromPortal,
    onAuthStateChange,
    signInWithGoogle,
    signOut,
    dai: { createChat, updateChat, saveMessage, listChats, listMessages }
  };

  window.dispatchEvent(new CustomEvent('dverse:ready', { detail: { configured: ready } }));
})();
