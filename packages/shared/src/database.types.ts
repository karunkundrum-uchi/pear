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
      groups: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_memberships: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: "owner" | "member"
          status: "pending" | "active"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          role: "owner" | "member"
          status?: "pending" | "active"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          role?: "owner" | "member"
          status?: "pending" | "active"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_invites: {
        Row: {
          id: string
          group_id: string
          inviter_user_id: string
          invite_code: string
          expires_at: string
          accepted_by_user_id: string | null
          status: "pending" | "accepted" | "expired" | "revoked"
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          inviter_user_id: string
          invite_code: string
          expires_at: string
          accepted_by_user_id?: string | null
          status?: "pending" | "accepted" | "expired" | "revoked"
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          inviter_user_id?: string
          invite_code?: string
          expires_at?: string
          accepted_by_user_id?: string | null
          status?: "pending" | "accepted" | "expired" | "revoked"
          created_at?: string
        }
        Relationships: []
      }
      friend_connections: {
        Row: {
          id: string
          user_id: string
          friend_user_id: string
          status: "pending" | "active" | "blocked"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_user_id: string
          status?: "pending" | "active" | "blocked"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_user_id?: string
          status?: "pending" | "active" | "blocked"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      accountability_preferences: {
        Row: {
          id: string
          owner_user_id: string
          group_id: string | null
          group_membership_id: string | null
          friend_connection_id: string | null
          scope_type: "group_default" | "membership_override" | "friend_default"
          exposure_level: "event_only" | "reason_summary" | "counts_only"
          notification_cadence: "realtime" | "daily_digest" | "weekly_digest" | "off"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          group_id?: string | null
          group_membership_id?: string | null
          friend_connection_id?: string | null
          scope_type: "group_default" | "membership_override" | "friend_default"
          exposure_level: "event_only" | "reason_summary" | "counts_only"
          notification_cadence: "realtime" | "daily_digest" | "weekly_digest" | "off"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          group_id?: string | null
          group_membership_id?: string | null
          friend_connection_id?: string | null
          scope_type?: "group_default" | "membership_override" | "friend_default"
          exposure_level?: "event_only" | "reason_summary" | "counts_only"
          notification_cadence?: "realtime" | "daily_digest" | "weekly_digest" | "off"
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
