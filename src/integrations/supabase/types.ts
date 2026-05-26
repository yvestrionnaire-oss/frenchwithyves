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
      __cancel_lesson_test_results: {
        Row: {
          outcome: string
          recorded_at: string
          test_name: string
        }
        Insert: {
          outcome: string
          recorded_at?: string
          test_name: string
        }
        Update: {
          outcome?: string
          recorded_at?: string
          test_name?: string
        }
        Relationships: []
      }
      availability_overrides: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["availability_override_kind"]
          note: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          kind: Database["public"]["Enums"]["availability_override_kind"]
          note?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["availability_override_kind"]
          note?: string | null
          starts_at?: string
        }
        Relationships: []
      }
      availability_rules: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          slot_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          slot_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          slot_time?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          created_at: string
          duration_minutes: number
          google_event_id: string | null
          id: string
          lesson_type: string
          meet_link: string | null
          occupied_range: unknown
          rescheduled_from: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          google_event_id?: string | null
          id?: string
          lesson_type?: string
          meet_link?: string | null
          occupied_range: unknown
          rescheduled_from?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          google_event_id?: string | null
          id?: string
          lesson_type?: string
          meet_link?: string | null
          occupied_range?: unknown
          rescheduled_from?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          student_id?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          credits: number
          currency: string
          description: string
          duration: string
          id: string
          is_active: boolean
          is_free: boolean
          is_recommended: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
        }
        Insert: {
          credits?: number
          currency?: string
          description?: string
          duration: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          is_recommended?: boolean
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
        }
        Update: {
          credits?: number
          currency?: string
          description?: string
          duration?: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          is_recommended?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          created_at: string
          credits_granted: number
          id: string
          notes: string | null
          package_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          credits_granted?: number
          id?: string
          notes?: string | null
          package_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          credits_granted?: number
          id?: string
          notes?: string | null
          package_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      reschedule_proposals: {
        Row: {
          created_at: string
          id: string
          initiated_by: string
          lesson_id: string
          message: string | null
          proposed_slot: string | null
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          initiated_by: string
          lesson_id: string
          message?: string | null
          proposed_slot?: string | null
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          initiated_by?: string
          lesson_id?: string
          message?: string | null
          proposed_slot?: string | null
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reschedule_proposals_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          lesson_id: string | null
          payload: Json
          read_at: string | null
          request_id: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          lesson_id?: string | null
          payload?: Json
          read_at?: string | null
          request_id?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lesson_id?: string | null
          payload?: Json
          read_at?: string | null
          request_id?: string | null
          student_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_trial: { Args: { _request_id: string }; Returns: undefined }
      assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      book_lesson: {
        Args: { _lesson_type?: string; _scheduled_at: string }
        Returns: string
      }
      book_lessons: {
        Args: { _duration_minutes?: number; _slots: string[] }
        Returns: string[]
      }
      booked_ranges: {
        Args: { _from: string; _to: string }
        Returns: {
          end_at: string
          start_at: string
        }[]
      }
      cancel_lesson: { Args: { _lesson_id: string }; Returns: undefined }
      cancel_request: { Args: { _request_id: string }; Returns: undefined }
      confirm_paid: { Args: { _request_id: string }; Returns: undefined }
      credit_balance: { Args: never; Returns: number }
      credit_balance_for: { Args: { _student_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_lesson_time_available: {
        Args: {
          _at: string
          _duration_minutes?: number
          _exclude_lesson?: string
        }
        Returns: boolean
      }
      is_valid_slot: {
        Args: { _at: string; _duration_minutes?: number }
        Returns: boolean
      }
      mark_payment_link_sent: {
        Args: { _request_id: string }
        Returns: undefined
      }
      request_package: {
        Args: { _notes?: string; _package_id: string }
        Returns: string
      }
      reschedule_lesson: {
        Args: { _lesson_id: string; _new_slot: string }
        Returns: undefined
      }
      revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      slot_conflicts: {
        Args: {
          _at: string
          _duration_minutes: number
          _exclude_lesson?: string
        }
        Returns: boolean
      }
      student_accept_proposal: {
        Args: { _proposal_id: string }
        Returns: undefined
      }
      student_decline_proposal: {
        Args: { _proposal_id: string }
        Returns: undefined
      }
      teacher_propose_reschedule: {
        Args: { _lesson_id: string; _message: string; _proposed_slot?: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "student" | "teacher"
      availability_override_kind: "block" | "open"
      lesson_status: "scheduled" | "completed" | "cancelled"
      purchase_status:
        | "pending"
        | "paid"
        | "cancelled"
        | "payment_link_sent"
        | "approved"
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
      app_role: ["student", "teacher"],
      availability_override_kind: ["block", "open"],
      lesson_status: ["scheduled", "completed", "cancelled"],
      purchase_status: [
        "pending",
        "paid",
        "cancelled",
        "payment_link_sent",
        "approved",
      ],
    },
  },
} as const
