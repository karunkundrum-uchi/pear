import { createClient } from "@supabase/supabase-js"
import type { Database } from "@pear/shared"

const storageAdapter = {
  async getItem(key: string) {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  },
  async setItem(key: string, value: string) {
    await chrome.storage.local.set({ [key]: value })
  },
  async removeItem(key: string) {
    await chrome.storage.local.remove(key)
  }
}

let client: ReturnType<typeof createClient<Database>> | undefined

export function getExtensionSupabase() {
  if (client) {
    return client
  }

  const url = process.env.PLASMO_PUBLIC_SUPABASE_URL
  const key = process.env.PLASMO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error("Missing Plasmo Supabase environment variables")
  }

  client = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: storageAdapter
    }
  })

  return client
}
