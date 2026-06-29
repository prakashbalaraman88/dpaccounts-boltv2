import { create } from 'zustand';
import { useAuthStore } from './authStore';
import {
  createTeam,
  getProjectLimitState,
  listTeamMembers,
  loadMyTeam,
  removeTeamMember,
  updateTeamMemberRole,
  upsertTeamMemberByEmail,
} from '../services/teamApi';

export const useTeamStore = create((set, get) => ({
  team: null,
  members: [],
  projectLimit: null,
  isLoading: false,
  error: '',

  loadTeam: async () => {
    const { user, profile } = useAuthStore.getState();
    if (!user) return;
    set({ isLoading: true, error: '' });
    try {
      const team = await loadMyTeam({ user, profile });
      const members = team.id ? await listTeamMembers(team.id) : [];
      const projectLimit = await getProjectLimitState({ team, userId: user.id });
      set({ team, members, projectLimit, isLoading: false });
      return team;
    } catch (error) {
      set({ error: error.message || 'Could not load team', isLoading: false });
      throw error;
    }
  },

  ensureTeam: async (name) => {
    const { team } = get();
    if (team?.id) return team;
    const { user, profile } = useAuthStore.getState();
    const created = await createTeam(name, { user, profile });
    await get().loadTeam();
    return created;
  },

  inviteMember: async (email, role) => {
    const { team } = get();
    if (!team?.id) throw new Error('Create a team before adding members.');
    await upsertTeamMemberByEmail(team.id, email, role);
    await get().loadTeam();
  },

  setMemberRole: async (memberId, role) => {
    await updateTeamMemberRole(memberId, role);
    await get().loadTeam();
  },

  removeMember: async (memberId) => {
    await removeTeamMember(memberId);
    await get().loadTeam();
  },

  refreshProjectLimit: async () => {
    const { user } = useAuthStore.getState();
    const { team } = get();
    const projectLimit = await getProjectLimitState({ team, userId: user?.id });
    set({ projectLimit });
    return projectLimit;
  },
}));

