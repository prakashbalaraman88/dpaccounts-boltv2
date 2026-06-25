import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

// ============================================
// SUPABASE CONFIG - Update these with your values
// from Supabase Dashboard > Project Settings > API
// ============================================
const SUPABASE_URL = 'https://sdnarwantjvwqzkaxwhc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbmFyd2FudGp2d3F6a2F4d2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzY5NzQsImV4cCI6MjA5Njc1Mjk3NH0.R1ZWQjKY6itBU7E1S8GGMTE6WRdyFD4aNf_XQAnUs1Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => true;

// ---------------------------------------------------------------------------
// Receipt image upload helpers
// ---------------------------------------------------------------------------

const UPLOAD_TIMEOUT_MS = 25000;

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function mimeTypeFromExtension(uri) {
  const ext = (uri.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

async function imageToArrayBuffer(imageUri) {
  let base64;
  let contentType = 'image/jpeg';

  if (imageUri.startsWith('data:')) {
    const match = imageUri.match(/^data:([^;]+);base64,(.*)$/);
    if (!match || !match[2]) {
      throw new Error('Invalid base64 data URI');
    }
    contentType = match[1] || contentType;
    base64 = match[2];
  } else if (imageUri.startsWith('file://')) {
    const fileUri = imageUri;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      throw new Error('Receipt file not found on device');
    }
    base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    contentType = mimeTypeFromExtension(fileUri);
  } else {
    throw new Error(`Unsupported image URI scheme: ${imageUri.slice(0, 30)}`);
  }

  const arrayBuffer = base64ToArrayBuffer(base64);
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Receipt image is empty');
  }
  return { arrayBuffer, contentType };
}

/**
 * Upload a receipt image to Supabase Storage.
 *
 * React Native's fetch Blob/File body is unreliable with Supabase JS, so we
 * read the image as base64 and upload an ArrayBuffer with an explicit
 * content-type. This works for file:// URIs and data: URIs alike.
 *
 * @param {string} imageUri - Local file URI (file://) or base64 data: URI
 * @param {number} projectId - Project ID for folder organization
 * @returns {string} Public URL of the uploaded image
 */
export async function uploadReceiptImage(imageUri, projectId) {
  // Make sure the user has an active Supabase session before uploading.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be signed in to upload receipts');
  }

  const { arrayBuffer, contentType } = await imageToArrayBuffer(imageUri);
  const ext = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const fileName = `${projectId}/${Date.now()}.${ext}`;

  const uploadPromise = supabase.storage
    .from('receipts')
    .upload(fileName, arrayBuffer, {
      contentType,
      upsert: false,
    });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Receipt upload timed out')), UPLOAD_TIMEOUT_MS)
  );

  const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

  if (error) {
    // Surface the real Supabase error message instead of swallowing it.
    throw new Error(`Supabase upload failed: ${error.message || JSON.stringify(error)}`);
  }
  if (!data?.path) {
    throw new Error('Supabase upload did not return a file path');
  }

  const { data: urlData } = supabase.storage
    .from('receipts')
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) {
    throw new Error('Could not generate public URL for uploaded receipt');
  }

  return urlData.publicUrl;
}
