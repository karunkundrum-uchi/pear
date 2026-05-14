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
          username: string
          inbound_notification_mode: "on" | "daily_digest_only" | "off"
          focus_intention: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          username?: string
          inbound_notification_mode?: "on" | "daily_digest_only" | "off"
          focus_intention?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          username?: string
          inbound_notification_mode?: "on" | "daily_digest_only" | "off"
          focus_intention?: string | null
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
          friend_user_id: string | null
          friend_label: string
          status: "pending" | "active" | "blocked"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_user_id?: string | null
          friend_label: string
          status?: "pending" | "active" | "blocked"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_user_id?: string | null
          friend_label?: string
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
      notifications: {
        Row: {
          id: string
          recipient_user_id: string
          sender_user_id: string
          override_event_id: string | null
          hostname: string
          method: "wait" | "reason"
          reason: string | null
          exposure_level: "event_only" | "reason_summary" | "counts_only"
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recipient_user_id: string
          sender_user_id: string
          override_event_id?: string | null
          hostname: string
          method: "wait" | "reason"
          reason?: string | null
          exposure_level: "event_only" | "reason_summary" | "counts_only"
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recipient_user_id?: string
          sender_user_id?: string
          override_event_id?: string | null
          hostname?: string
          method?: "wait" | "reason"
          reason?: string | null
          exposure_level?: "event_only" | "reason_summary" | "counts_only"
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      pings: {
        Row: {
          id: string
          sender_user_id: string
          recipient_user_id: string
          notification_id: string | null
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sender_user_id: string
          recipient_user_id: string
          notification_id?: string | null
          message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sender_user_id?: string
          recipient_user_id?: string
          notification_id?: string | null
          message?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_profile_username: {
        Args: {
          profile_id: string
          requested_username?: string
        }
        Returns: string
      }
      claim_profile_username: {
        Args: {
          profile_id: string
          requested_username: string
        }
        Returns: string
      }
      find_profile_by_username: {
        Args: {
          requested_username: string
        }
        Returns: {
          id: string
          username: string
          display_name: string | null
        }[]
      }
      get_public_profiles: {
        Args: {
          profile_ids: string[]
        }
        Returns: {
          id: string
          username: string
          display_name: string | null
        }[]
      }
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
