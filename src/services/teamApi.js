import { supabase } from './supabase';
import { getPlanById, normalizeTeamRole, SUBSCRIPTION_PLANS, TEAM_ROLES } from '../constants/access';

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST116', 'PGRST200', 'PGRST204', 'PGRST205']);

function isMissingTeamBackend(error) {
  return MISSING_TABLE_CODES.has(error?.code) || /does not exist|schema cache/i.test(error?.message || '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function fallbackTeam(profile, user) {
  const email = normalizeEmail(profile?.email || user?.email);
  return {
    id: null,
    name: profile?.display_name ? `${profile.display_name}'s Team` : 'My Team',
    owner_id: user?.id || profile?.id || null,
    backendReady: false,
    currentMember: {
      email,
      role: TEAM_ROLES.ADMIN,
      status: 'active',
    },
    subscription: {
      plan_id: SUBSCRIPTION_PLANS.FREE.id,
      status: 'free',
      current_period_end: null,
    },
  };
}

export async function loadMyTeam({ user, profile }) {
  if (!user?.id) return fallbackTeam(profile, user);

  try {
    const { data: memberships, error } = await supabase
      .from('team_members')
      .select(`
        *,
        teams:team_id (
          id,
          name,
          owner_id,
          created_at,
          subscriptions (
            id,
            plan_id,
            status,
            current_period_end
          )
        )
      `)
      .or(`user_id.eq.${user.id},email.eq.${normalizeEmail(profile?.email || user.email)}`)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw error;

    const member = memberships?.[0];
    const team = member?.teams;
    if (!member || !team) return fallbackTeam(profile, user);

    return {
      ...team,
      backendReady: true,
      currentMember: {
        ...member,
        role: normalizeTeamRole(member.role),
      },
      subscription: team.subscriptions?.[0] || {
        plan_id: SUBSCRIPTION_PLANS.FREE.id,
        status: 'free',
        current_period_end: null,
      },
    };
  } catch (error) {
    if (isMissingTeamBackend(error)) return fallbackTeam(profile, user);
    throw error;
  }
}

export async function createTeam(name, { user, profile }) {
  if (!user?.id) throw new Error('Not authenticated');
  const email = normalizeEmail(profile?.email || user.email);

  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name: name?.trim() || 'My Team', owner_id: user.id })
    .select()
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: user.id,
      email,
      role: TEAM_ROLES.ADMIN,
      status: 'active',
    });
  if (memberError) throw memberError;

  await supabase
    .from('subscriptions')
    .insert({
      team_id: team.id,
      plan_id: SUBSCRIPTION_PLANS.FREE.id,
      status: 'free',
    });

  return team;
}

export async function listTeamMembers(teamId) {
  if (!teamId) return [];
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingTeamBackend(error)) return [];
    throw error;
  }
  return data || [];
}

export async function upsertTeamMemberByEmail(teamId, email, role) {
  if (!teamId) throw new Error('Create a team before inviting members.');
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Enter a valid email address.');
  }

  const { data, error } = await supabase
    .from('team_members')
    .upsert(
      {
        team_id: teamId,
        email: normalizedEmail,
        role: normalizeTeamRole(role),
        status: 'invited',
        invited_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,email' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTeamMemberRole(memberId, role) {
  const { error } = await supabase
    .from('team_members')
    .update({ role: normalizeTeamRole(role), updated_at: new Date().toISOString() })
    .eq('id', memberId);
  if (error) throw error;
}

export async function removeTeamMember(memberId) {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}

export async function getProjectLimitState({ team, userId }) {
  const plan = getPlanById(team?.subscription?.plan_id);
  const query = supabase.from('projects').select('id', { count: 'exact', head: true });

  if (team?.id) {
    query.eq('team_id', team.id);
  } else if (userId) {
    query.eq('created_by', userId);
  }

  const { count, error } = await query;
  if (error && !isMissingTeamBackend(error)) throw error;

  const used = count || 0;
  return {
    plan,
    used,
    remaining: Math.max(plan.projectLimit - used, 0),
    canCreate: used < plan.projectLimit,
  };
}
