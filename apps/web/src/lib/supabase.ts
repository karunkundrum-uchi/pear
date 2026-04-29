import { createClient } from "@supabase/supabase-js"
import type { Database } from "@pear/shared"

type ClerkSessionLike = {
  getToken: () => Promise<string | null>
}

export function createClerkSupabaseClient(session: ClerkSessionLike | null | undefined) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient<Database>(url, key, {
    accessToken: async () => session?.getToken() ?? null
  })
}
