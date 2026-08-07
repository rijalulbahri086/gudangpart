import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase URL atau Anon Key belum terpasang di .env.local!');
}

export const supabase = createClient(
  supabaseUrl || 'https://xyz.supabase.co',
  supabaseAnonKey || 'anon'
);