import { requireNativeModule } from 'expo-modules-core';

const LedgeShareHandler = requireNativeModule('LedgeShareHandler');

/**
 * Check if there are pending shares without consuming them.
 * Use this to detect if a redirect to the share screen is needed.
 */
export async function hasPendingShares() {
  try {
    return await LedgeShareHandler.hasPendingShares() || false;
  } catch (e) {
    console.warn('[LedgeShareHandler] hasPendingShares failed:', e);
    return false;
  }
}

/**
 * Get any pending shares that arrived while the app was closed (cold start)
 * or while the JS layer was not active. Returns and clears the pending list.
 */
export async function getPendingShares() {
  try {
    return (await LedgeShareHandler.getPendingShares()) || [];
  } catch (e) {
    console.warn('[LedgeShareHandler] getPendingShares failed:', e);
    return [];
  }
}

/**
 * Clear any pending shares from a previous session.
 */
export function clearPendingShares() {
  try {
    LedgeShareHandler.clearPendingShares();
  } catch (e) {
    console.warn('[LedgeShareHandler] clearPendingShares failed:', e);
  }
}
