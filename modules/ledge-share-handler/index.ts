import { requireOptionalNativeModule } from 'expo-modules-core';

const LedgeShareHandler = requireOptionalNativeModule('LedgeShareHandler');

/**
 * Check if there are pending shares without consuming them.
 * Returns true if the native module has a cached share waiting for JS.
 */
export async function hasPendingShares(): Promise<boolean> {
  try {
    return LedgeShareHandler?.hasPendingShares() ?? false;
  } catch (e) {
    console.warn('[LedgeShareHandler] hasPendingShares failed:', e);
    return false;
  }
}

export interface PendingShare {
  type: 'file' | 'text';
  path?: string;
  mimeType?: string;
  text?: string;
}

/**
 * Get all pending shares and clear the queue.
 * The native module pre-copies content:// URIs to stable file:// paths in
 * OnCreate/OnNewIntent — by the time this is called, paths are always safe.
 */
export async function getPendingShares(): Promise<PendingShare[]> {
  try {
    const result = await LedgeShareHandler?.getPendingShares();
    return (result as PendingShare[]) ?? [];
  } catch (e) {
    console.warn('[LedgeShareHandler] getPendingShares failed:', e);
    return [];
  }
}

/**
 * Clear any pending shares without consuming them.
 */
export function clearPendingShares(): void {
  try {
    LedgeShareHandler?.clearPendingShares();
  } catch (e) {
    console.warn('[LedgeShareHandler] clearPendingShares failed:', e);
  }
}
