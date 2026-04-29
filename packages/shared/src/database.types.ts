export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      block_windows: {
        Row: {
          id: string
          user_id: string
          label: string
          day_of_week: number
          start_time: string
          end_time: string
          timezone: string
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label?: string
          day_of_week: number
          start_time: string
          end_time: string
          timezone?: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          label?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          timezone?: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      blocked_sites: {
        Row: {
          id: string
          user_id: string
          label: string
          hostname: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label: string
          hostname: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          label?: string
          hostname?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      override_events: {
        Row: {
          id: string
          user_id: string
          hostname: string
          method: "wait" | "reason"
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          hostname: string
          method: "wait" | "reason"
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          hostname?: string
          method?: "wait" | "reason"
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type TableRow<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"]

export type TableInsert<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Insert"]
