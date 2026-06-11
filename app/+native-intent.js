import { getShareExtensionKey } from 'expo-share-intent';

export function redirectSystemPath({ path, initial }) {
  try {
    const shareKey = getShareExtensionKey({ scheme: 'interiorbooks' });
    if (__DEV__) {
      console.log('[native-intent] path:', path, 'initial:', initial, 'shareKey:', shareKey);
    }
    if (path.includes(shareKey)) {
      return '/share';
    }
  } catch (e) {
    if (__DEV__) {
      console.error('[native-intent] Error:', e);
    }
  }
  return path;
}
