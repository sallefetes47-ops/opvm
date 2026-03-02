import { createClient } from '@supabase/supabase-js';

// استخدام import.meta.env بدلاً من process.env لأننا في Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ CRITICAL: Supabase credentials missing!");
  console.error("VITE_SUPABASE_URL:", supabaseUrl ? "✓ present" : "✗ MISSING");
  console.error("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✓ present" : "✗ MISSING");
}

// Fallback values to prevent 'supabaseKey is required' crash and white screen
// These will fail gracefully on actual API calls but prevent app crash
const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

export const supabase = createClient(
  supabaseUrl && supabaseUrl.trim() !== '' ? supabaseUrl : FALLBACK_URL,
  supabaseAnonKey && supabaseAnonKey.trim() !== '' ? supabaseAnonKey : FALLBACK_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'opvm-web-client',
      },
    },
  }
);

// Helper to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl && 
    supabaseUrl.trim() !== '' && 
    supabaseAnonKey && 
    supabaseAnonKey.trim() !== '' &&
    supabaseUrl !== FALLBACK_URL &&
    supabaseAnonKey !== FALLBACK_KEY
  );
}
