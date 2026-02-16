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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      file_studies: {
        Row: {
          committee_opinion: string
          created_at: string
          created_by: string | null
          file_id: string
          id: string
          notes: string | null
          permit_type: string | null
          rejection_reason: string | null
          study_date: string
        }
        Insert: {
          committee_opinion: string
          created_at?: string
          created_by?: string | null
          file_id: string
          id?: string
          notes?: string | null
          permit_type?: string | null
          rejection_reason?: string | null
          study_date?: string
        }
        Update: {
          committee_opinion?: string
          created_at?: string
          created_by?: string | null
          file_id?: string
          id?: string
          notes?: string | null
          permit_type?: string | null
          rejection_reason?: string | null
          study_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_studies_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          address: string
          built_area: number | null
          committee_opinion:
          | Database["public"]["Enums"]["committee_opinion"]
          | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          demolition_reason: string | null
          engineer_name: string | null
          file_number: string
          floors_count: number | null
          full_name: string
          id: string
          is_deleted: boolean | null
          location_lat: number | null
          location_lng: number | null
          lot_number: string | null
          municipality: Database["public"]["Enums"]["municipality"]
          ownership_type: Database["public"]["Enums"]["ownership_type"]
          permit_type: Database["public"]["Enums"]["permit_type"] | null
          plot_area: number | null
          plots_count: number | null
          property_group: string | null
          property_reference: string | null
          rejection_reason: string | null
          section: string | null
          session_date: string | null
          shares_count: number | null
          subdivision_name: string | null
          submission_date: string | null
          total_area: number | null
          updated_at: string
          work_duration: string | null
          year: number
        }
        Insert: {
          address: string
          built_area?: number | null
          committee_opinion?:
          | Database["public"]["Enums"]["committee_opinion"]
          | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          demolition_reason?: string | null
          engineer_name?: string | null
          file_number: string
          floors_count?: number | null
          full_name: string
          id?: string
          is_deleted?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          lot_number?: string | null
          municipality: Database["public"]["Enums"]["municipality"]
          ownership_type: Database["public"]["Enums"]["ownership_type"]
          permit_type?: Database["public"]["Enums"]["permit_type"] | null
          plot_area?: number | null
          plots_count?: number | null
          property_group?: string | null
          property_reference?: string | null
          rejection_reason?: string | null
          section?: string | null
          session_date?: string | null
          shares_count?: number | null
          subdivision_name?: string | null
          submission_date?: string | null
          total_area?: number | null
          updated_at?: string
          work_duration?: string | null
          year?: number
        }
        Update: {
          address?: string
          built_area?: number | null
          committee_opinion?:
          | Database["public"]["Enums"]["committee_opinion"]
          | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          demolition_reason?: string | null
          engineer_name?: string | null
          file_number?: string
          floors_count?: number | null
          full_name?: string
          id?: string
          is_deleted?: boolean | null
          location_lat?: number | null
          location_lng?: number | null
          lot_number?: string | null
          municipality?: Database["public"]["Enums"]["municipality"]
          ownership_type?: Database["public"]["Enums"]["ownership_type"]
          permit_type?: Database["public"]["Enums"]["permit_type"] | null
          plot_area?: number | null
          plots_count?: number | null
          property_group?: string | null
          property_reference?: string | null
          rejection_reason?: string | null
          section?: string | null
          session_date?: string | null
          shares_count?: number | null
          subdivision_name?: string | null
          submission_date?: string | null
          total_area?: number | null
          updated_at?: string
          work_duration?: string | null
          year?: number
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          content_text: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_date: string | null
          document_number: string | null
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          keywords: string[] | null
          language: string | null
          status: "active" | "trashed" // Added status field
          title_ar: string
          title_fr: string | null
          updated_at: string
        }
        Insert: {
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          keywords?: string[] | null
          language?: string | null
          status?: "active" | "trashed" // Added status field
          title_ar: string
          title_fr?: string | null
          updated_at?: string
        }
        Update: {
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          keywords?: string[] | null
          language?: string | null
          status?: "active" | "trashed" // Added status field
          title_ar?: string
          title_fr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meeting_minutes: {
        Row: {
          agenda: string | null
          attendees: string[] | null
          created_at: string
          created_by: string | null
          decisions: string | null
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          session_date: string
          session_number: string | null
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          attendees?: string[] | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          session_date: string
          session_number?: string | null
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          attendees?: string[] | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          session_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      summons: {
        Row: {
          attendance_status: string | null
          committee_members: string[] | null
          created_at: string
          created_by: string | null
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          summons_date: string
          summons_number: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          attendance_status?: string | null
          committee_members?: string[] | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          summons_date: string
          summons_number?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          attendance_status?: string | null
          committee_members?: string[] | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          summons_date?: string
          summons_number?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "viewer"
      committee_opinion: "رأي إيجابي" | "تحفظ" | "مرفوض"
      municipality: "غرداية" | "العطف" | "بونورة"
      ownership_type: "عقد ملكية" | "دفتر عقاري" | "شهادة إستفادة"
      permit_type: "رخصة بناء" | "رخصة تجزئة" | "رخصة هدم" | "شهادة تقسيم"
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
      app_role: ["admin", "employee", "viewer"],
      committee_opinion: ["رأي إيجابي", "تحفظ", "مرفوض"],
      municipality: ["غرداية", "العطف", "بونورة"],
      ownership_type: ["عقد ملكية", "دفتر عقاري", "شهادة إستفادة"],
      permit_type: ["رخصة بناء", "رخصة تجزئة", "رخصة هدم", "شهادة تقسيم"],
    },
  },
} as const
