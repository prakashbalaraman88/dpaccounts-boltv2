export const TEAM_ROLES = {
  SITE_SUPERVISOR: 'site_supervisor',
  PROJECT_MANAGER: 'project_manager',
  ADMIN: 'admin',
};

export const TEAM_ROLE_OPTIONS = [
  {
    id: TEAM_ROLES.SITE_SUPERVISOR,
    label: 'Site Supervisor',
    description: 'Can send receipts to assigned projects without seeing totals.',
    icon: 'clipboard-camera-outline',
  },
  {
    id: TEAM_ROLES.PROJECT_MANAGER,
    label: 'Project Manager',
    description: 'Can see expense totals and project activity for assigned projects.',
    icon: 'briefcase-account-outline',
  },
  {
    id: TEAM_ROLES.ADMIN,
    label: 'Admin',
    description: 'Full access to projects, team members, settings, and subscription.',
    icon: 'shield-account-outline',
  },
];

export const ROLE_PERMISSIONS = {
  [TEAM_ROLES.SITE_SUPERVISOR]: {
    canSubmitReceipts: true,
    canViewExpenseTotals: false,
    canViewIncomingTotals: false,
    canViewProfit: false,
    canManageTeam: false,
    canManageSubscription: false,
    canEditProject: false,
  },
  [TEAM_ROLES.PROJECT_MANAGER]: {
    canSubmitReceipts: true,
    canViewExpenseTotals: true,
    canViewIncomingTotals: false,
    canViewProfit: false,
    canManageTeam: false,
    canManageSubscription: false,
    canEditProject: true,
  },
  [TEAM_ROLES.ADMIN]: {
    canSubmitReceipts: true,
    canViewExpenseTotals: true,
    canViewIncomingTotals: true,
    canViewProfit: true,
    canManageTeam: true,
    canManageSubscription: true,
    canEditProject: true,
  },
};

export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: 'free',
    label: 'Free',
    priceMonthlyInr: 0,
    projectLimit: 1,
    memberLimit: null,
  },
  PRO: {
    id: 'pro',
    label: 'Pro',
    priceMonthlyInr: 299,
    projectLimit: 10,
    memberLimit: null,
  },
};

export function getRoleOption(role) {
  return TEAM_ROLE_OPTIONS.find((item) => item.id === role) || TEAM_ROLE_OPTIONS[0];
}

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[TEAM_ROLES.SITE_SUPERVISOR];
}

export function normalizeTeamRole(role) {
  if (Object.values(TEAM_ROLES).includes(role)) return role;
  return TEAM_ROLES.SITE_SUPERVISOR;
}

export function getPlanById(planId) {
  return planId === SUBSCRIPTION_PLANS.PRO.id
    ? SUBSCRIPTION_PLANS.PRO
    : SUBSCRIPTION_PLANS.FREE;
}

