import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabaseConfig'

let supabaseClient: SupabaseClient | null = null
try {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} catch (e) {
  console.warn('Supabase client init failed:', e)
}

export default supabaseClient
