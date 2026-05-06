export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bars_directory: {
        Row: {
          address: string | null
          created_at: string
          google_place_id: string
          id: string
          keywords_matched: string[] | null
          last_refreshed_at: string
          lat: number
          lng: number
          name: string
          orientation_confidence: number | null
          orientation_deg: number | null
          orientation_method: string | null
          outdoor_seating: boolean | null
          outdoor_source: string
          price_level: number | null
          rating: number | null
          sun_score_timeline: Json | null
          sun_timeline: Json | null
          timeline_computed_at: string | null
          timeline_date: string | null
          timeline_inputs_hash: string | null
          types: string[] | null
          updated_at: string
          user_ratings_total: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          google_place_id: string
          id?: string
          keywords_matched?: string[] | null
          last_refreshed_at?: string
          lat: number
          lng: number
          name: string
          orientation_confidence?: number | null
          orientation_deg?: number | null
          orientation_method?: string | null
          outdoor_seating?: boolean | null
          outdoor_source?: string
          price_level?: number | null
          rating?: number | null
          sun_score_timeline?: Json | null
          sun_timeline?: Json | null
          timeline_computed_at?: string | null
          timeline_date?: string | null
          timeline_inputs_hash?: string | null
          types?: string[] | null
          updated_at?: string
          user_ratings_total?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          google_place_id?: string
          id?: string
          keywords_matched?: string[] | null
          last_refreshed_at?: string
          lat?: number
          lng?: number
          name?: string
          orientation_confidence?: number | null
          orientation_deg?: number | null
          orientation_method?: string | null
          outdoor_seating?: boolean | null
          outdoor_source?: string
          price_level?: number | null
          rating?: number | null
          sun_score_timeline?: Json | null
          sun_timeline?: Json | null
          timeline_computed_at?: string | null
          timeline_date?: string | null
          timeline_inputs_hash?: string | null
          types?: string[] | null
          updated_at?: string
          user_ratings_total?: number | null
        }
        Relationships: []
      }
      custom_spots: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          icon: string
          id: string
          lat: number
          lng: number
          name: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          icon?: string
          id?: string
          lat: number
          lng: number
          name: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          icon?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          locale: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          locale?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          locale?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_bars: {
        Row: {
          alerts_enabled: boolean
          bar_id: number
          bar_name: string
          created_at: string
          id: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          bar_id: number
          bar_name: string
          created_at?: string
          id?: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          bar_id?: number
          bar_name?: string
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      friend_proximity_mutes: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          requested_by: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_by: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          cooldown_minutes: number
          enabled: boolean
          quiet_end_hour: number
          quiet_start_hour: number
          threshold_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cooldown_minutes?: number
          enabled?: boolean
          quiet_end_hour?: number
          quiet_start_hour?: number
          threshold_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cooldown_minutes?: number
          enabled?: boolean
          quiet_end_hour?: number
          quiet_start_hour?: number
          threshold_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      overpass_buildings_cache: {
        Row: {
          buildings: Json
          buildings_hash: string
          created_at: string
          expires_at: string
          fetched_at: string
          id: string
          lat: number
          lng: number
          radius_m: number
          tile_key: string
          updated_at: string
        }
        Insert: {
          buildings: Json
          buildings_hash: string
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          lat: number
          lng: number
          radius_m: number
          tile_key: string
          updated_at?: string
        }
        Update: {
          buildings?: Json
          buildings_hash?: string
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          lat?: number
          lng?: number
          radius_m?: number
          tile_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      places_fetch_cache: {
        Row: {
          created_at: string
          id: string
          last_fetched_at: string
          lat: number
          lng: number
          radius_m: number
          result_count: number
          tile_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_fetched_at?: string
          lat: number
          lng: number
          radius_m: number
          result_count?: number
          tile_key: string
        }
        Update: {
          created_at?: string
          id?: string
          last_fetched_at?: string
          lat?: number
          lng?: number
          radius_m?: number
          result_count?: number
          tile_key?: string
        }
        Relationships: []
      }
      presence_sessions: {
        Row: {
          activity: string
          bar_id: string | null
          created_at: string
          expires_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          activity: string
          bar_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          activity?: string
          bar_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_sessions_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          handle: string | null
          id: string
          proximity_notifications_enabled: boolean
          status_emoji: string | null
          status_text: string | null
          status_updated_at: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["profile_visibility"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id: string
          proximity_notifications_enabled?: boolean
          status_emoji?: string | null
          status_text?: string | null
          status_updated_at?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id?: string
          proximity_notifications_enabled?: boolean
          status_emoji?: string | null
          status_text?: string | null
          status_updated_at?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Relationships: []
      }
      proximity_notifications: {
        Row: {
          friend_id: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          friend_id: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          friend_id?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sun_alerts: {
        Row: {
          id: string
          read_at: string | null
          sent_at: string
          sun_pct: number
          target_kind: string
          target_name: string
          target_ref: string
          user_id: string
        }
        Insert: {
          id?: string
          read_at?: string | null
          sent_at?: string
          sun_pct: number
          target_kind: string
          target_name: string
          target_ref: string
          user_id: string
        }
        Update: {
          id?: string
          read_at?: string | null
          sent_at?: string
          sun_pct?: number
          target_kind?: string
          target_name?: string
          target_ref?: string
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          confidence: string
          id: string
          imported_at: string
          lat: number | null
          lng: number | null
          name: string
          needs_geocoding: boolean
          neighborhood: string
          note: string | null
          outdoor_type: string[]
          sources: Json
          venue_type: string[]
        }
        Insert: {
          confidence: string
          id?: string
          imported_at?: string
          lat?: number | null
          lng?: number | null
          name: string
          needs_geocoding?: boolean
          neighborhood: string
          note?: string | null
          outdoor_type: string[]
          sources: Json
          venue_type: string[]
        }
        Update: {
          confidence?: string
          id?: string
          imported_at?: string
          lat?: number | null
          lng?: number | null
          name?: string
          needs_geocoding?: boolean
          neighborhood?: string
          note?: string | null
          outdoor_type?: string[]
          sources?: Json
          venue_type?: string[]
        }
        Relationships: []
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_presence_sessions: {
        Row: {
          activity: string | null
          bar_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          location_lat: number | null
          location_lng: number | null
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          activity?: string | null
          bar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          location_lat?: never
          location_lng?: never
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity?: string | null
          bar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          location_lat?: never
          location_lng?: never
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presence_sessions_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars_directory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      can_view_profile: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      cleanup_expired_presence: { Args: never; Returns: undefined }
      cleanup_proximity_log: { Args: never; Returns: undefined }
      evaluate_proximity: {
        Args: { _session_id: string }
        Returns: {
          friend_display_name: string
          friend_id: string
          friend_status_emoji: string
          recipient_id: string
        }[]
      }
      get_profile_for_viewer: {
        Args: { _target_handle: string }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
          id: string
          status_emoji: string
          status_text: string
          status_updated_at: string
          visibility: Database["public"]["Enums"]["profile_visibility"]
        }[]
      }
      is_allowed_status_emoji: { Args: { _e: string }; Returns: boolean }
      list_recent_proximity_alerts: {
        Args: never
        Returns: {
          friend_display_name: string
          friend_handle: string
          friend_id: string
          muted: boolean
          sent_at: string
        }[]
      }
      list_visible_friend_summaries: {
        Args: never
        Returns: {
          display_name: string
          friendship_id: string
          handle: string
          requested_by: string
          status: Database["public"]["Enums"]["friendship_status"]
          status_emoji: string
          user_id: string
        }[]
      }
      record_proximity_sent: {
        Args: { _friend: string; _recipient: string }
        Returns: undefined
      }
      send_friend_request: {
        Args: { _target: string }
        Returns: {
          created_at: string
          id: string
          requested_by: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
          user_a: string
          user_b: string
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      friendship_status: "pending" | "accepted" | "blocked"
      profile_visibility: "friends_only" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      friendship_status: ["pending", "accepted", "blocked"],
      profile_visibility: ["friends_only", "private"],
    },
  },
} as const
