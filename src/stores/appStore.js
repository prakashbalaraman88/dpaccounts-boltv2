import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { useAuthStore } from './authStore';
import { annotateProjects } from '../utils/annotateProjects';

// Build-time default so fresh installs work before an admin saves a key.
// Set EXPO_PUBLIC_AI_API_KEY (or legacy EXPO_PUBLIC_OPENROUTER_API_KEY) in .env (gitignored).
const DEFAULT_AI_KEY =
  process.env.EXPO_PUBLIC_AI_API_KEY ||
  process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ||
  '';

export const useAppStore = create((set, get) => ({
  projects: [],
  currentProject: null,
  messages: [],
  isLoading: false,
  aiApiKey: DEFAULT_AI_KEY,
  overallCategoryBreakdown: [],
  // Last project limit passed to loadProjects so internal callers (createProject,
  // updateProject, deleteProject) can reload with the same limit without needing
  // the subscription context.
  _projectLimit: Infinity,
  // A project-level lock so rapid transaction saves (e.g. user tapping
  // multiple categories or concurrent share-intent processing) never race.
  _txnLocks: new Map(),

  // === SETTINGS ===

  loadSettings: async () => {
    // Guard: don't query if not authenticated
    if (!useAuthStore.getState().session) return;
    try {
      const { data: rows, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['ai_api_key', 'openrouter_api_key']);
      if (!error && rows?.length) {
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        const key = map['ai_api_key'] || map['openrouter_api_key'] || DEFAULT_AI_KEY;
        if (key) set({ aiApiKey: key });
      }
    } catch (error) {
      console.log('Failed to load AI API key from settings:', error);
    }
  },

  setAiApiKey: async (key) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'ai_api_key',
          value: key,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
    set({ aiApiKey: key });
  },

  // === PROJECTS ===

  loadProjects: async (projectLimit) => {
    // Guard: don't query if not authenticated
    if (!useAuthStore.getState().session) return;

    // Remember the limit so internal reload callers (createProject, etc.) can
    // use the same value without needing the subscription context.
    const limit = projectLimit ?? get()._projectLimit;
    set({ isLoading: true, _projectLimit: limit });

    try {
      // Fetch projects — RLS ensures users only see assigned projects, admins see all
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch the latest message for each project (for preview)
      const projectsWithLastMessage = await Promise.all(
        (projects || []).map(async (project) => {
          const { data: msgs } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...project,
            last_message: msgs?.[0]?.content || null,
            last_message_time: msgs?.[0]?.created_at || null,
          };
        })
      );

      // Sort by latest activity
      projectsWithLastMessage.sort((a, b) => {
        const aTime = a.last_message_time || a.created_at;
        const bTime = b.last_message_time || b.created_at;
        return new Date(bTime) - new Date(aTime);
      });

      // ── Server-authoritative lock status ────────────────────────────────
      // Call the Supabase RPC get_project_lock_status() — no client-supplied
      // limit. The RPC reads from user_entitlements (written exclusively by
      // the revenuecat-webhook Edge Function) and ranks projects server-side.
      // Falls back to client-side index-based locking only when the migration
      // has not been applied yet (e.g. local dev before supabase db push).
      let lockMap = {};
      try {
        const { data: lockRows, error: lockError } = await supabase.rpc('get_project_lock_status');
        if (!lockError && lockRows) {
          for (const row of lockRows) {
            lockMap[row.id] = row.locked;
          }
        } else if (lockError) {
          console.warn('[loadProjects] RPC unavailable, using client-side lock fallback:', lockError.message);
        }
      } catch (rpcErr) {
        console.warn('[loadProjects] RPC error, using client-side lock fallback:', rpcErr);
      }

      // Apply lock status: use server result when available; otherwise fall
      // back to index position against the client-side plan limit.
      const finalProjects = annotateProjects(projectsWithLastMessage, limit, lockMap);

      set({ projects: finalProjects, isLoading: false });
    } catch (error) {
      console.error('Failed to load projects:', error);
      set({ isLoading: false });
    }
  },

  createProject: async (clientName, projectName, description, budget) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        client_name: clientName,
        project_name: projectName,
        description: description || '',
        budget: budget || 0,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-add creator as project member
    await supabase
      .from('project_members')
      .insert({ project_id: data.id, user_id: userId });

    await get().loadProjects();
    return data.id;
  },

  updateProject: async (id, fields) => {
    const allowed = ['client_name', 'project_name', 'description', 'budget'];
    const updateData = { updated_at: new Date().toISOString() };
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updateData[key] = value;
      }
    }

    const { error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    await get().loadProjects();
    const current = get().currentProject;
    if (current && current.id === id) {
      await get().loadProject(id);
    }
  },

  deleteProject: async (id) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await get().loadProjects();
  },

  loadProject: async (id) => {
    // Guard against a malformed route param (NaN) reaching the query layer.
    if (id === null || id === undefined || Number.isNaN(Number(id))) {
      throw new Error('Invalid project id');
    }

    // ── Server-side lock check (data-access boundary) ────────────────────
    // Call is_project_locked() before loading any project data. This ensures
    // deep-link and direct-navigation paths cannot bypass the lock even if the
    // in-memory projects list is empty or stale. The RPC reads from the
    // server-owned user_entitlements table — the client cannot influence the result.
    //
    // Fail-closed in production: if the RPC call fails for any reason other
    // than the function not existing yet (PGRST202 = unknown function), we treat
    // the project as locked to prevent data leakage under misconfiguration.
    try {
      const { data: locked, error: lockErr } = await supabase.rpc('is_project_locked', {
        p_project_id: Number(id),
      });
      if (lockErr) {
        // PGRST202: function does not exist (migration not yet applied — dev env)
        const notDeployed = lockErr.code === 'PGRST202' || lockErr.message?.includes('does not exist');
        if (notDeployed) {
          console.warn('[loadProject] is_project_locked RPC not deployed yet, skipping lock check');
        } else {
          // Any other server error → fail closed in production
          console.error('[loadProject] Lock check failed, blocking project access:', lockErr.message);
          throw new Error('PROJECT_LOCKED');
        }
      } else if (locked === true) {
        throw new Error('PROJECT_LOCKED');
      }
    } catch (e) {
      if (e?.message === 'PROJECT_LOCKED') throw e;
      // Unexpected JS error — fail closed
      console.error('[loadProject] Unexpected lock check error, blocking:', e?.message);
      throw new Error('PROJECT_LOCKED');
    }

    // Fetch project
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projError) throw projError;

    // Fetch messages with their associated transactions. The embedded
    // `transactions(...)` select relies on PostgREST detecting the
    // messages→transactions foreign key. If that relationship can't be
    // embedded for any reason, the whole project screen used to crash; fall
    // back to a plain messages query so the chat still loads.
    let messages = [];
    try {
      const { data, error: msgError } = await supabase
        .from('messages')
        .select(`
          *,
          transactions (
            id,
            type,
            amount,
            category_id,
            category_label,
            vendor,
            receipt_uri
          )
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;
      messages = data || [];
    } catch (embedErr) {
      console.warn('Embedded messages query failed, falling back to plain query:', embedErr?.message);
      const { data, error: plainErr } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: true });
      if (plainErr) throw plainErr;
      messages = (data || []).map((m) => ({ ...m, transactions: [] }));
    }

    // Flatten transaction data onto each message to match old SQLite format
    // UI expects: item.transaction_id, item.transaction_type, item.amount, etc.
    const flatMessages = (messages || []).map((msg) => {
      const txn = msg.transactions?.[0] || null;
      return {
        id: msg.id,
        project_id: msg.project_id,
        type: msg.type,
        content: msg.content,
        image_uri: msg.image_uri,
        sender: msg.sender,
        sender_id: msg.sender_id,
        created_at: msg.created_at,
        transaction_id: txn?.id || null,
        transaction_type: txn?.type || null,
        amount: txn?.amount || null,
        category_id: txn?.category_id || null,
        category_label: txn?.category_label || null,
        vendor: txn?.vendor || null,
        receipt_uri: txn?.receipt_uri || null,
      };
    });

    set({ currentProject: project, messages: flatMessages });
  },

  // === MESSAGES ===

  addMessage: async (projectId, type, content, imageUri, sender) => {
    const userId = useAuthStore.getState().user?.id;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        project_id: projectId,
        type,
        content,
        image_uri: imageUri,
        sender,
        sender_id: userId || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Append locally instead of reloading the whole chat — keeps sends
    // instant (WhatsApp-style). Full reloads happen on transaction commit.
    const { currentProject, messages } = get();
    if (currentProject && currentProject.id === projectId) {
      set({
        messages: [
          ...messages,
          {
            id: data.id,
            project_id: data.project_id,
            type: data.type,
            content: data.content,
            image_uri: data.image_uri,
            sender: data.sender,
            sender_id: data.sender_id,
            created_at: data.created_at,
            transaction_id: null,
            transaction_type: null,
            amount: null,
            category_id: null,
            category_label: null,
            vendor: null,
            receipt_uri: null,
          },
        ],
      });
    }
    return data.id;
  },

  // Swap a message's image for its cloud URL once the background upload
  // finishes (the bubble shows the local file instantly in the meantime).
  updateMessageImage: async (messageId, projectId, imageUri) => {
    try {
      await supabase.from('messages').update({ image_uri: imageUri }).eq('id', messageId);
      const { currentProject, messages } = get();
      if (currentProject && currentProject.id === projectId) {
        set({
          messages: messages.map((m) =>
            m.id === messageId ? { ...m, image_uri: imageUri } : m
          ),
        });
      }
    } catch (e) {
      console.warn('Failed to update message image:', e?.message);
    }
  },

  // === TRANSACTIONS ===

  // Internal helper: per-project transaction lock prevents concurrent
  // addTransaction calls from racing (e.g. user tapping save twice, or
  // share-intent processing overlapping with manual entry).
  _acquireTxnLock: async (projectId) => {
    const locks = get()._txnLocks;
    while (locks.has(projectId)) {
      await locks.get(projectId);
    }
    let resolveLock;
    const lockPromise = new Promise((r) => { resolveLock = r; });
    locks.set(projectId, lockPromise);
    return () => { locks.delete(projectId); resolveLock(); };
  },

  addTransaction: async (projectId, messageId, type, amount, categoryId, categoryLabel, description, options = {}) => {
    const releaseLock = await get()._acquireTxnLock(projectId);
    try {
      const userId = useAuthStore.getState().user?.id;
    const {
      vendor = '',
      paymentMethod = '',
      transactionDate = null,
      notes = '',
      receiptUri = null,
    } = options;

    const { error } = await supabase
      .from('transactions')
      .insert({
        project_id: projectId,
        message_id: messageId,
        type,
        amount,
        category_id: categoryId,
        category_label: categoryLabel,
        description: description || '',
        vendor,
        payment_method: paymentMethod,
        transaction_date: transactionDate,
        notes,
        receipt_uri: receiptUri,
        created_by: userId || null,
      });

    if (error) throw error;

    // Recalculate project totals
    await supabase.rpc('recalculate_project_totals', { p_project_id: projectId });

    await get().loadProject(projectId);
    await get().loadProjects();
    } finally {
      releaseLock();
    }
  },

  updateTransaction: async (id, projectId, fields) => {
    const allowed = ['type', 'amount', 'category_id', 'category_label',
                     'description', 'vendor', 'payment_method',
                     'transaction_date', 'notes', 'receipt_uri'];
    const updateData = {};
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) return;

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    await supabase.rpc('recalculate_project_totals', { p_project_id: projectId });

    await get().loadProject(projectId);
    await get().loadProjects();
  },

  deleteTransaction: async (id, projectId) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await supabase.rpc('recalculate_project_totals', { p_project_id: projectId });

    await get().loadProject(projectId);
    await get().loadProjects();
  },

  // === ANALYTICS ===

  loadOverallCategoryBreakdown: async () => {
    try {
      const { data, error } = await supabase.rpc('get_category_breakdown');
      if (error) throw error;
      set({ overallCategoryBreakdown: data || [] });
    } catch (error) {
      console.error('Failed to load category breakdown:', error);
    }
  },
}));
