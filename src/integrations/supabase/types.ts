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
          outdoor_seating: boolean | null
          outdoor_source: string
          price_level: number | null
          rating: number | null
          sun_timeline: Json | null
          timeline_computed_at: string | null
          timeline_date: string | null
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
          outdoor_seating?: boolean | null
          outdoor_source?: string
          price_level?: number | null
          rating?: number | null
          sun_timeline?: Json | null
          timeline_computed_at?: string | null
          timeline_date?: string | null
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
          outdoor_seating?: boolean | null
          outdoor_source?: string
          price_level?: number | null
          rating?: number | null
          sun_timeline?: Json | null
          timeline_computed_at?: string | null
          timeline_date?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
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
    Enums: {},
  },
} as const
