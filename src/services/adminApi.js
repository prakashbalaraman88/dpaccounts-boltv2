import { supabase } from './supabase';

/**
 * Create a new user account (admin only)
 * Calls the Supabase Edge Function which uses the service role key
 */
export async function createUserAccount(email, password, displayName = '') {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { email, password, display_name: displayName },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * List all users (admin only — RLS enforced)
 */
export async function listAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Update a user's role (admin only)
 */
export async function setUserRole(userId, role) {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Assign a user to a project
 */
export async function assignUserToProject(projectId, userId) {
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId });
  if (error && error.code !== '23505') throw error; // Ignore duplicate
}

/**
 * Remove a user from a project
 */
export async function removeUserFromProject(projectId, userId) {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Get all members of a project
 */
export async function getProjectMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('*, profiles:user_id(id, email, display_name, role)')
    .eq('project_id', projectId);
  if (error) throw error;
  return data;
}

/**
 * Get all projects with their member counts (admin view)
 */
export async function getAllProjectsWithMembers() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_members(user_id, profiles:user_id(email, display_name))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
