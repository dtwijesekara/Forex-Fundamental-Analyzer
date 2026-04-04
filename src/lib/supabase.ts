// ============================================================
// FOREX FUNDAMENTAL ANALYZER — Supabase Client
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

// Client-safe Supabase client (uses anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client (uses service role key, bypasses RLS)
// Only use in API routes and workers — never expose service role key to browser
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set it in .env.local — only use admin client in server-side code.'
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Type-safe table names
export const TABLES = {
  ECONOMIC_EVENTS: 'economic_events',
  CENTRAL_BANK_BIAS: 'central_bank_bias',
  CURRENCY_SCORES: 'currency_scores',
  PAIR_BIAS: 'pair_bias',
  MARKET_REGIME: 'market_regime',
  INTERMARKET_DATA: 'intermarket_data',
  ALERTS_LOG: 'alerts_log',
  SYSTEM_HEALTH: 'system_health',
  COT_DATA: 'cot_data',
} as const;
