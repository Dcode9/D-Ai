(function () {
  const SUPABASE_URL = window.DVERSE_SUPABASE_URL || 'https://gmwieijbrrztukqpfwkg.supabase.co';
  const SUPABASE_KEY = window.DVERSE_SUPABASE_KEY || 'sb_publishable_KX3MYtV84QJJdy9bPDuMEA_V99sLKSE';
  const ready = Boolean(window.supabase && SUPABASE_URL && SUPABASE_KEY);
  const client = ready ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function signInWithGoogle() {
    if (!client) throw new Error('D\'Verse Supabase client is not configured.');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href.split('#')[0] }
    });
    if (error) throw error;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
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

  window.dverse = {
    ...(window.dverse || {}),
    supabase: client,
    isConfigured: ready,
    getSession,
    signInWithGoogle,
    signOut,
    dai: { createChat, saveMessage, listChats }
  };
})();