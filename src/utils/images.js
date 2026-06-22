// Receipt image preparation: downscale + JPEG-compress before anything
// touches base64. Full-resolution phone screenshots (1080x2400 PNGs, 2-8MB)
// ballooned into 4-10MB base64 strings on the share path, which is enough
// to OOM-crash the app on mid-range Androids. 1280px JPEG q0.7 keeps every
// receipt legible for the vision model at ~150-300KB.

import { Platform } from 'react-native';

// 1024px keeps GPay/receipt text fully legible for the vision models while
// cutting the base64 payload ~35% vs 1280 — directly faster uploads+inference.
const MAX_WIDTH = 1024;
const JPEG_QUALITY = 0.7;

async function manipulate(uri) {
  const M = await import('expo-image-manipulator');

  // Legacy one-shot API (still shipped in SDK 55)
  if (typeof M.manipulateAsync === 'function') {
    return M.manipulateAsync(uri, [{ resize: { width: MAX_WIDTH } }], {
      compress: JPEG_QUALITY,
      format: M.SaveFormat.JPEG,
      base64: true,
    });
  }

  // New context API
  const ctx = M.ImageManipulator.manipulate(uri);
  ctx.resize({ width: MAX_WIDTH });
  const image = await ctx.renderAsync();
  return image.saveAsync({
    compress: JPEG_QUALITY,
    format: M.SaveFormat.JPEG,
    base64: true,
  });
}

/**
 * Normalize any image URI (content://, file://, data:) into a small JPEG.
 *
 * @returns {{ uri: string, dataUri: string|null }}
 *   uri      — local file URI of the downscaled image
 *   dataUri  — data:image/jpeg;base64 payload for the AI call
 */
export async function prepareReceiptImage(sourceUri) {
  try {
    const result = await manipulate(sourceUri);
    return {
      uri: result.uri,
      dataUri: result.base64 ? `data:image/jpeg;base64,${result.base64}` : null,
    };
  } catch (e) {
    console.error('prepareReceiptImage failed:', e);
    throw new Error(`Could not prepare image: ${e?.message || 'unknown error'}`);
  }
}
