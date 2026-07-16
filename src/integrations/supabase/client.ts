import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const IS_DESKTOP = import.meta.env.VITE_APP_MODE === 'desktop';

// In desktop (Electron) mode we swap the cloud client for a local PGlite-backed
// adapter that mimics the supabase-js fluent API. The web build is unchanged.
let exported: any;

if (IS_DESKTOP) {
  // Synchronous import works because Vite tree-shakes this branch in web builds.
  const { localSupabase } = await import('../local-db/local-supabase-adapter');
  exported = localSupabase;
} else {
  exported = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = exported as ReturnType<typeof createClient<Database>>;
