import { createClient } from "@supabase/supabase-js"
import type { Database } from "@pear/shared"

let browserClient: ReturnType<typeof createClient<Database>> | undefined

export function getBrowserSupabase() {
  if (browserClient) {
    return browserClient
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables")
  }

  browserClient = createClient<Database>(url, key)
  return browserClient
}
