'use strict';

const { describe, test, expect, beforeEach } = require('@jest/globals');
const { annotateProjects } = require('../src/utils/annotateProjects');

// ─── Pure dashboard calculation helpers ──────────────────────────────────────
// These mirror the exact expressions in app/dashboard.js so any drift between
// the component and the formulas will break this test.

function computeDashboardTotals(projects) {
  const unlockedProjects = projects.filter((p) => !p.locked);
  const lockedCount = projects.length - unlockedProjects.length;

  const totalIncoming = unlockedProjects.reduce((sum, p) => sum + p.total_incoming, 0);
  const totalExpense = unlockedProjects.reduce((sum, p) => sum + p.total_expense, 0);
  const netPnl = totalIncoming - totalExpense;
  const totalBudget = unlockedProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const projectCount = unlockedProjects.length;
  const activeProjects = unlockedProjects.filter(
    (p) => p.total_incoming > 0 || p.total_expense > 0
  ).length;

  const showLockedBanner = lockedCount > 0;
  const pnlListProjects = unlockedProjects;

  return {
    unlockedProjects,
    lockedCount,
    totalIncoming,
    totalExpense,
    netPnl,
    totalBudget,
    projectCount,
    activeProjects,
    showLockedBanner,
    pnlListProjects,
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(overrides) {
  return {
    id: overrides.id ?? 1,
    client_name: overrides.client_name ?? 'Client',
    project_name: overrides.project_name ?? 'Project',
    total_incoming: overrides.total_incoming ?? 0,
    total_expense: overrides.total_expense ?? 0,
    budget: overrides.budget ?? 0,
    locked: overrides.locked ?? false,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00Z',
  };
}

// Three unlocked, two locked — mimics a mid-session subscription downgrade
// where the two oldest projects become locked.
function mixedProjects() {
  return [
    makeProject({ id: 1, total_incoming: 50000, total_expense: 20000, budget: 60000, locked: false }),
    makeProject({ id: 2, total_incoming: 30000, total_expense: 15000, budget: 40000, locked: false }),
    makeProject({ id: 3, total_incoming: 0,     total_expense: 0,     budget: 0,     locked: false }),
    makeProject({ id: 4, total_incoming: 80000, total_expense: 40000, budget: 90000, locked: true }),
    makeProject({ id: 5, total_incoming: 10000, total_expense: 5000,  budget: 20000, locked: true }),
  ];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Dashboard analytics — locked-project filtering', () => {

  describe('when all projects are unlocked (active subscription)', () => {
    let projects;
    let totals;

    beforeEach(() => {
      projects = [
        makeProject({ id: 1, total_incoming: 50000, total_expense: 20000, budget: 60000 }),
        makeProject({ id: 2, total_incoming: 30000, total_expense: 15000, budget: 40000 }),
      ];
      totals = computeDashboardTotals(projects);
    });

    test('project count equals total number of projects', () => {
      expect(totals.projectCount).toBe(2);
    });

    test('net P&L includes all projects', () => {
      expect(totals.totalIncoming).toBe(80000);
      expect(totals.totalExpense).toBe(35000);
      expect(totals.netPnl).toBe(45000);
    });

    test('active count reflects projects with any transactions', () => {
      expect(totals.activeProjects).toBe(2);
    });

    test('locked banner is hidden', () => {
      expect(totals.showLockedBanner).toBe(false);
      expect(totals.lockedCount).toBe(0);
    });

    test('P&L list contains all projects', () => {
      expect(totals.pnlListProjects).toHaveLength(2);
    });
  });

  describe('when some projects are locked (subscription lapsed mid-session)', () => {
    let totals;

    beforeEach(() => {
      totals = computeDashboardTotals(mixedProjects());
    });

    test('NET P&L only reflects unlocked projects', () => {
      // Unlocked: id 1 (50k/20k) + id 2 (30k/15k) + id 3 (0/0)
      expect(totals.totalIncoming).toBe(80000);
      expect(totals.totalExpense).toBe(35000);
      expect(totals.netPnl).toBe(45000);
    });

    test('locked projects income and expense are excluded from totals', () => {
      // Locked projects would add 90000 incoming / 45000 expense — must not appear
      expect(totals.totalIncoming).not.toBe(170000);
      expect(totals.totalExpense).not.toBe(80000);
    });

    test('project count excludes locked projects', () => {
      expect(totals.projectCount).toBe(3);
    });

    test('active count excludes locked projects', () => {
      // Unlocked actives: id 1 and id 2 have transactions; id 3 has none
      expect(totals.activeProjects).toBe(2);
    });

    test('total budget excludes locked projects', () => {
      // Unlocked budgets: 60000 + 40000 + 0 = 100000
      expect(totals.totalBudget).toBe(100000);
    });

    test('locked banner is shown', () => {
      expect(totals.showLockedBanner).toBe(true);
    });

    test('locked count is correct', () => {
      expect(totals.lockedCount).toBe(2);
    });

    test('project-wise P&L list contains no locked projects', () => {
      const ids = totals.pnlListProjects.map((p) => p.id);
      expect(ids).not.toContain(4);
      expect(ids).not.toContain(5);
    });

    test('project-wise P&L list contains all unlocked projects', () => {
      const ids = totals.pnlListProjects.map((p) => p.id);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
    });
  });

  describe('when all projects are locked (full lapse)', () => {
    let totals;

    beforeEach(() => {
      const projects = [
        makeProject({ id: 1, total_incoming: 50000, total_expense: 20000, locked: true }),
        makeProject({ id: 2, total_incoming: 30000, total_expense: 15000, locked: true }),
      ];
      totals = computeDashboardTotals(projects);
    });

    test('net P&L is zero', () => {
      expect(totals.netPnl).toBe(0);
      expect(totals.totalIncoming).toBe(0);
      expect(totals.totalExpense).toBe(0);
    });

    test('project count is zero', () => {
      expect(totals.projectCount).toBe(0);
    });

    test('active count is zero', () => {
      expect(totals.activeProjects).toBe(0);
    });

    test('locked banner is shown', () => {
      expect(totals.showLockedBanner).toBe(true);
    });

    test('P&L list is empty', () => {
      expect(totals.pnlListProjects).toHaveLength(0);
    });
  });

  describe('annotateProjects — subscription downgrade simulation', () => {
    const sortedProjects = [
      makeProject({ id: 1, total_incoming: 50000, total_expense: 20000 }),
      makeProject({ id: 2, total_incoming: 30000, total_expense: 15000 }),
      makeProject({ id: 3, total_incoming: 10000, total_expense: 5000  }),
      makeProject({ id: 4, total_incoming: 80000, total_expense: 40000 }),
    ];

    test('unlimited plan leaves all projects unlocked', () => {
      const result = annotateProjects(sortedProjects, Infinity, {});
      expect(result.every((p) => !p.locked)).toBe(true);
    });

    test('client-side fallback: projects beyond the plan limit are locked', () => {
      // Simulate downgrade from unlimited → 2-project plan
      const result = annotateProjects(sortedProjects, 2, {});
      expect(result[0].locked).toBe(false);
      expect(result[1].locked).toBe(false);
      expect(result[2].locked).toBe(true);
      expect(result[3].locked).toBe(true);
    });

    test('server lock map takes precedence over index-based fallback', () => {
      const lockMap = { 1: false, 2: true, 3: false, 4: true };
      const result = annotateProjects(sortedProjects, 2, lockMap);
      expect(result.find((p) => p.id === 1).locked).toBe(false);
      expect(result.find((p) => p.id === 2).locked).toBe(true);
      expect(result.find((p) => p.id === 3).locked).toBe(false);
      expect(result.find((p) => p.id === 4).locked).toBe(true);
    });

    test('dashboard totals after client-side downgrade annotation are correct', () => {
      const annotated = annotateProjects(sortedProjects, 2, {});
      const totals = computeDashboardTotals(annotated);
      // Only first 2 projects unlocked: 50000+30000 = 80000 in, 20000+15000 = 35000 ex
      expect(totals.totalIncoming).toBe(80000);
      expect(totals.totalExpense).toBe(35000);
      expect(totals.netPnl).toBe(45000);
      expect(totals.projectCount).toBe(2);
      expect(totals.lockedCount).toBe(2);
      expect(totals.showLockedBanner).toBe(true);
    });

    test('dashboard totals after server-map annotation are correct', () => {
      const lockMap = { 1: false, 2: false, 3: true, 4: true };
      const annotated = annotateProjects(sortedProjects, Infinity, lockMap);
      const totals = computeDashboardTotals(annotated);
      expect(totals.totalIncoming).toBe(80000);
      expect(totals.totalExpense).toBe(35000);
      expect(totals.netPnl).toBe(45000);
      expect(totals.projectCount).toBe(2);
      expect(totals.lockedCount).toBe(2);
      expect(totals.showLockedBanner).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('zero projects — no banner, all totals are zero', () => {
      const totals = computeDashboardTotals([]);
      expect(totals.projectCount).toBe(0);
      expect(totals.netPnl).toBe(0);
      expect(totals.activeProjects).toBe(0);
      expect(totals.showLockedBanner).toBe(false);
      expect(totals.pnlListProjects).toHaveLength(0);
    });

    test('project with no transactions is not counted as active', () => {
      const projects = [
        makeProject({ id: 1, total_incoming: 0, total_expense: 0, locked: false }),
      ];
      const totals = computeDashboardTotals(projects);
      expect(totals.activeProjects).toBe(0);
      expect(totals.projectCount).toBe(1);
    });

    test('project with only income but no expense is counted as active', () => {
      const projects = [
        makeProject({ id: 1, total_incoming: 10000, total_expense: 0, locked: false }),
      ];
      const totals = computeDashboardTotals(projects);
      expect(totals.activeProjects).toBe(1);
    });

    test('project with only expense but no income is counted as active', () => {
      const projects = [
        makeProject({ id: 1, total_incoming: 0, total_expense: 5000, locked: false }),
      ];
      const totals = computeDashboardTotals(projects);
      expect(totals.activeProjects).toBe(1);
    });

    test('net P&L is negative when expenses exceed income', () => {
      const projects = [
        makeProject({ id: 1, total_incoming: 10000, total_expense: 30000, locked: false }),
      ];
      const totals = computeDashboardTotals(projects);
      expect(totals.netPnl).toBe(-20000);
    });

    test('budget missing (undefined) does not corrupt totalBudget', () => {
      const projects = [
        makeProject({ id: 1, total_incoming: 0, total_expense: 0, budget: undefined, locked: false }),
        makeProject({ id: 2, total_incoming: 0, total_expense: 0, budget: 50000,    locked: false }),
      ];
      const totals = computeDashboardTotals(projects);
      expect(totals.totalBudget).toBe(50000);
    });
  });
});
