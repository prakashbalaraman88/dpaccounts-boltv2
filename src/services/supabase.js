import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// SUPABASE CONFIG - Update these with your values
// from Supabase Dashboard > Project Settings > API
// ============================================
const SUPABASE_URL = 'https://vhpodtyzgwxjigkmpvfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZocG9kdHl6Z3d4amlna21wdmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDI0NDcsImV4cCI6MjA4Nzc3ODQ0N30.XrZRzi6lN8Tkvhg4BfF57z9W-kPngzDxWLixfWIp7Hg';

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
export async function uploadReceiptImage(imageUri, projectId) {
  // fetch() handles data:, file://, blob:, and https: URIs alike
  const response = await fetch(imageUri);
  const blob = await response.blob();

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
