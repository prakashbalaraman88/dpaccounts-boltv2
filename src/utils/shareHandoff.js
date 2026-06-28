import AsyncStorage from '@react-native-async-storage/async-storage';

const SHARE_KEY_PREFIX = '@ledge/share-handoff/';
const SHARE_INDEX_KEY = '@ledge/share-handoff-index';
const MAX_SHARE_AGE_MS = 24 * 60 * 60 * 1000;

function makeShareId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function pruneOldShares(now = Date.now()) {
  try {
    const raw = await AsyncStorage.getItem(SHARE_INDEX_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids) || ids.length === 0) return;

    const keep = [];
    await Promise.all(ids.map(async (id) => {
      const value = await AsyncStorage.getItem(SHARE_KEY_PREFIX + id);
      if (!value) return;
      try {
        const parsed = JSON.parse(value);
        if (now - Number(parsed.createdAt || 0) < MAX_SHARE_AGE_MS) {
          keep.push(id);
          return;
        }
      } catch {
        // Drop malformed entries.
      }
      await AsyncStorage.removeItem(SHARE_KEY_PREFIX + id);
    }));
    await AsyncStorage.setItem(SHARE_INDEX_KEY, JSON.stringify(keep));
  } catch (e) {
    console.warn('[share-handoff] prune failed:', e);
  }
}

export async function saveShareHandoff(shareData) {
  const id = makeShareId();
  const payload = {
    id,
    createdAt: Date.now(),
    imageUri: shareData?.imageUri || null,
    text: shareData?.text || null,
    source: shareData?.source || 'unknown',
  };

  await pruneOldShares(payload.createdAt);
  await AsyncStorage.setItem(SHARE_KEY_PREFIX + id, JSON.stringify(payload));

  try {
    const raw = await AsyncStorage.getItem(SHARE_INDEX_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    const nextIds = Array.isArray(ids) ? [...ids, id].slice(-12) : [id];
    await AsyncStorage.setItem(SHARE_INDEX_KEY, JSON.stringify(nextIds));
  } catch (e) {
    console.warn('[share-handoff] index update failed:', e);
  }

  return payload;
}

export async function getShareHandoff(id) {
  if (!id) return null;
  try {
    const raw = await AsyncStorage.getItem(SHARE_KEY_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[share-handoff] read failed:', e);
    return null;
  }
}

export async function clearShareHandoff(id) {
  if (!id) return;
  try {
    await AsyncStorage.removeItem(SHARE_KEY_PREFIX + id);
    const raw = await AsyncStorage.getItem(SHARE_INDEX_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids)) {
      await AsyncStorage.setItem(SHARE_INDEX_KEY, JSON.stringify(ids.filter((item) => item !== id)));
    }
  } catch (e) {
    console.warn('[share-handoff] clear failed:', e);
  }
}
