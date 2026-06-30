import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

// ─── Mock expo-router ─────────────────────────────────────────────────────────
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: jest.fn(() => false),
  }),
  useFocusEffect: (cb) => { cb(); },
}));

// ─── Mock appStore ────────────────────────────────────────────────────────────
jest.mock('../src/stores/appStore', () => ({
  useAppStore: jest.fn(),
}));

// ─── Imports that depend on mocks ─────────────────────────────────────────────
import { useAppStore } from '../src/stores/appStore';
import DashboardScreen from '../app/dashboard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const UNLOCKED_1 = {
  id: 1,
  client_name: 'Acme Corp',
  project_name: 'Brand Refresh',
  total_incoming: 50000,
  total_expense: 20000,
  budget: 60000,
  locked: false,
};
const UNLOCKED_2 = {
  id: 2,
  client_name: 'Beta Ltd',
  project_name: 'App Build',
  total_incoming: 30000,
  total_expense: 15000,
  budget: 40000,
  locked: false,
};
const INACTIVE_UNLOCKED = {
  id: 3,
  client_name: 'Gamma Inc',
  project_name: 'Strategy',
  total_incoming: 0,
  total_expense: 0,
  budget: 0,
  locked: false,
};
const LOCKED_1 = {
  id: 4,
  client_name: 'Locked Alpha',
  project_name: 'Hidden Project',
  total_incoming: 80000,
  total_expense: 40000,
  budget: 90000,
  locked: true,
};
const LOCKED_2 = {
  id: 5,
  client_name: 'Locked Beta',
  project_name: 'Hidden Work',
  total_incoming: 10000,
  total_expense: 5000,
  budget: 20000,
  locked: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setupStore(projects, overallCategoryBreakdown = []) {
  useAppStore.mockReturnValue({
    projects,
    loadProjects: jest.fn(),
    overallCategoryBreakdown,
    loadOverallCategoryBreakdown: jest.fn(),
  });
}

function renderDashboard() {
  return render(
    <PaperProvider>
      <DashboardScreen />
    </PaperProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardScreen — locked-project filtering when subscription lapses', () => {

  describe('when all projects are unlocked (active subscription)', () => {
    beforeEach(() => {
      setupStore([UNLOCKED_1, UNLOCKED_2]);
      renderDashboard();
    });

    it('shows the full NET P&L (income - expense across all projects)', () => {
      // 50000 + 30000 = 80000 in; 20000 + 15000 = 35000 ex; net = +45000
      expect(screen.getByText(/45,000/)).toBeTruthy();
    });

    it('shows the correct project count', () => {
      // Both "Projects" and "Active" stat boxes show 2 in this scenario —
      // confirm the Projects label exists alongside the count.
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Projects')).toBeTruthy();
    });

    it('does not show the locked-projects banner', () => {
      expect(screen.queryByText(/hidden — upgrade/)).toBeNull();
    });

    it('renders both project cards in the P&L list', () => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
      expect(screen.getByText('Beta Ltd')).toBeTruthy();
    });
  });

  describe('when some projects are locked (subscription lapsed mid-session)', () => {
    beforeEach(() => {
      setupStore([UNLOCKED_1, UNLOCKED_2, INACTIVE_UNLOCKED, LOCKED_1, LOCKED_2]);
      renderDashboard();
    });

    it('NET P&L only reflects unlocked project totals', () => {
      // Unlocked: (50000+30000) - (20000+15000) = 45000
      expect(screen.getByText(/45,000/)).toBeTruthy();
    });

    it('does not include locked project income in the displayed total', () => {
      // If locked were included, total incoming = 170000 (₹1,70,000 in en-IN)
      expect(screen.queryByText(/1,70,000/)).toBeNull();
    });

    it('shows project count for unlocked projects only', () => {
      // 3 unlocked projects
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('shows active count for unlocked projects only', () => {
      // UNLOCKED_1 and UNLOCKED_2 have transactions; INACTIVE_UNLOCKED does not
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('shows the locked-projects banner with the correct count', () => {
      expect(screen.getByText(/2 project.*hidden — upgrade/)).toBeTruthy();
    });

    it('locked-projects banner navigates to the paywall when pressed', () => {
      fireEvent.press(screen.getByText(/2 project.*hidden — upgrade/));
      expect(mockPush).toHaveBeenCalledWith('/paywall');
    });

    it('does not render a card for locked project "Locked Alpha"', () => {
      expect(screen.queryByText('Locked Alpha')).toBeNull();
    });

    it('does not render a card for locked project "Locked Beta"', () => {
      expect(screen.queryByText('Locked Beta')).toBeNull();
    });

    it('still renders cards for all unlocked projects', () => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
      expect(screen.getByText('Beta Ltd')).toBeTruthy();
    });
  });

  describe('when all projects are locked (full lapse)', () => {
    beforeEach(() => {
      setupStore([LOCKED_1, LOCKED_2]);
      renderDashboard();
    });

    it('shows zero NET P&L', () => {
      expect(screen.getAllByText(/₹0/).length).toBeGreaterThan(0);
    });

    it('shows project count of 0', () => {
      // All stat boxes show 0; confirm the Projects label and at least one '0' exist.
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Projects')).toBeTruthy();
    });

    it('shows the locked-projects banner', () => {
      expect(screen.getByText(/2 project.*hidden — upgrade/)).toBeTruthy();
    });

    it('locked-projects banner navigates to paywall', () => {
      fireEvent.press(screen.getByText(/2 project.*hidden — upgrade/));
      expect(mockPush).toHaveBeenCalledWith('/paywall');
    });

    it('renders no project P&L cards', () => {
      expect(screen.queryByText('Locked Alpha')).toBeNull();
      expect(screen.queryByText('Locked Beta')).toBeNull();
    });

    it('shows the empty state message', () => {
      expect(screen.getByText('No projects to analyze yet')).toBeTruthy();
    });
  });

  describe('when there are no projects at all', () => {
    beforeEach(() => {
      setupStore([]);
      renderDashboard();
    });

    it('does not show the locked-projects banner', () => {
      expect(screen.queryByText(/hidden — upgrade/)).toBeNull();
    });

    it('shows the empty state', () => {
      expect(screen.getByText('No projects to analyze yet')).toBeTruthy();
    });
  });
});
