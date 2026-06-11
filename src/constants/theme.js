import { MD3DarkTheme } from 'react-native-paper';

// CRED-inspired premium dark theme
export const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Backgrounds
    background: '#080808',
    surface: '#101010',
    surfaceElevated: '#181818',
    surfaceHighlight: '#222222',
    surfaceVariant: '#1C1C1C',

    // Primary accent (silver white)
    primary: '#E8E8E8',
    primaryContainer: '#1E1E1E',
    primaryMuted: '#888888',

    // Accent (warm gold for highlights)
    accent: '#C9A87C',
    accentContainer: '#2A1F14',
    accentMuted: '#8B7355',

    // Text
    onBackground: '#F5F5F5',
    onSurface: '#F0F0F0',
    onSurfaceVariant: '#8A8A8A',
    secondary: '#666666',

    // Borders
    outline: 'rgba(255,255,255,0.07)',
    outlineVariant: 'rgba(255,255,255,0.12)',

    // Status colors
    incoming: '#4ADE80',
    incomingMuted: 'rgba(74,222,128,0.10)',
    incomingBg: 'rgba(74,222,128,0.06)',
    expense: '#FB7185',
    expenseMuted: 'rgba(251,113,133,0.10)',
    expenseBg: 'rgba(251,113,133,0.06)',

    // Chat
    chatBubbleSent: '#1A1510',
    chatBubbleReceived: '#141414',
    chatBackground: '#080808',

    // Others
    error: '#FB7185',
    divider: 'rgba(255,255,255,0.06)',
    fab: '#E8E8E8',
    backdrop: 'rgba(0,0,0,0.75)',
  },
  roundness: 16,
};

export const CATEGORIES = {
  incoming: [
    { id: 'current_account', label: 'Current Account', icon: 'bank' },
    { id: 'savings_account', label: 'Savings Account', icon: 'piggy-bank' },
    { id: 'cash', label: 'Cash', icon: 'cash' },
    { id: 'cheque', label: 'Cheque', icon: 'checkbook' },
    { id: 'others_incoming', label: 'Others', icon: 'dots-horizontal-circle' },
  ],
  expense: [
    { id: 'measurements', label: 'Measurements', icon: 'ruler' },
    { id: 'designer_architect', label: 'Designer/Architect', icon: 'floor-plan' },
    { id: 'construction_material', label: 'Construction Material', icon: 'wall' },
    { id: 'factory_materials', label: 'Factory Materials', icon: 'factory' },
    { id: 'onsite_materials', label: 'Onsite Materials', icon: 'package-variant' },
    { id: 'jobwork', label: 'Jobwork', icon: 'hammer-wrench' },
    { id: 'carpenter', label: 'Carpenter', icon: 'hand-saw' },
    { id: 'electrician', label: 'Electrician', icon: 'lightning-bolt' },
    { id: 'false_ceiling', label: 'False Ceiling', icon: 'ceiling-light' },
    { id: 'operational', label: 'Operational', icon: 'cog' },
    { id: 'others_expense', label: 'Others', icon: 'dots-horizontal-circle' },
  ],
};

export const ALL_CATEGORIES = [...CATEGORIES.incoming, ...CATEGORIES.expense];

export const formatRupees = (amount) => {
  if (amount === null || amount === undefined) return '₹0';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-IN');
  return `₹${formatted}`;
};

export const formatRupeesShort = (amount) => {
  if (amount === null || amount === undefined) return '₹0';
  const absAmount = Math.abs(amount);
  if (absAmount >= 10000000) return `₹${(absAmount / 10000000).toFixed(1)}Cr`;
  if (absAmount >= 100000) return `₹${(absAmount / 100000).toFixed(1)}L`;
  if (absAmount >= 1000) return `₹${(absAmount / 1000).toFixed(1)}K`;
  return `₹${absAmount}`;
};
