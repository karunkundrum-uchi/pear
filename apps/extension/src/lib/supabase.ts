import { createClient } from "@supabase/supabase-js"
import type { Database } from "@pear/shared"

export function createExtensionSupabaseClient(token: string | null) {
  const url = process.env.PLASMO_PUBLIC_SUPABASE_URL
  const key = process.env.PLASMO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error("Missing Plasmo Supabase environment variables")
  }

  return createClient<Database>(url, key, {
    accessToken: async () => token
  })
}
