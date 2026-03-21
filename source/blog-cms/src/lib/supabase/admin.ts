import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Server-side only.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase admin client is not configured.')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
