import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

/**
 * Upload a receipt image to Supabase Storage
 * @param {string} imageUri - Local file URI, data: URI, or content:// URI
 * @param {number} projectId - Project ID for folder organization
 * @returns {string} Public URL of the uploaded image
 */
const UPLOAD_FETCH_TIMEOUT_MS = 20000;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadReceiptImage(imageUri, projectId) {
  // fetch() handles data:, file://, blob:, and https: URIs alike
  const response = await fetchWithTimeout(imageUri, {}, UPLOAD_FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Failed to read image for upload: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Image file is empty or unreadable');
  }

  const contentType = blob.type || 'image/jpeg';
  const ext = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const fileName = `${projectId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(fileName, blob, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('receipts')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
