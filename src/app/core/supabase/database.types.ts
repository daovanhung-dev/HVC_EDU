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
      attendance: {
        Row: {
          enrollment_id: string
          id: string
          marked_at: string
          marked_by: string
          note: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          enrollment_id: string
          id?: string
          marked_at?: string
          marked_by: string
          note?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          enrollment_id?: string
          id?: string
          marked_at?: string
          marked_by?: string
          note?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          center_id: string | null
          created_at: string
          id: string
          resource_id: string | null
          resource_type: string
          trace_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          center_id?: string | null
          created_at?: string
          id?: string
          resource_id?: string | null
          resource_type: string
          trace_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          center_id?: string | null
          created_at?: string
          id?: string
          resource_id?: string | null
          resource_type?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      class_assignments: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          end_date: string | null
          id: string
          role: Database["public"]["Enums"]["assignment_role"]
          staff_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          role: Database["public"]["Enums"]["assignment_role"]
          staff_id: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          role?: Database["public"]["Enums"]["assignment_role"]
          staff_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          end_time: string | null
          id: string
          start_time: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          end_time: string | null
          id: string
          note: string | null
          session_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          note?: string | null
          session_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          note?: string | null
          session_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          center_id: string
          code: string
          created_at: string
          grade: number
          id: string
          name: string
          note: string | null
          status: Database["public"]["Enums"]["entity_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          center_id: string
          code: string
          created_at?: string
          grade: number
          id?: string
          name: string
          note?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          center_id?: string
          code?: string
          created_at?: string
          grade?: number
          id?: string
          name?: string
          note?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          enrolled_from: string
          enrolled_to: string | null
          id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enrolled_from: string
          enrolled_to?: string | null
          id?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enrolled_from?: string
          enrolled_to?: string | null
          id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          center_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          transaction_date: string
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          center_id: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          transaction_date: string
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          center_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          transaction_date?: string
          type?: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          center_id: string
          created_at: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          center_id: string
          created_at?: string
          full_name: string
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          center_id?: string
          created_at?: string
          full_name?: string
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          center_id: string
          code: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          note: string | null
          phone: string | null
          staff_type: Database["public"]["Enums"]["staff_type"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          center_id: string
          code: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          note?: string | null
          phone?: string | null
          staff_type?: Database["public"]["Enums"]["staff_type"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          center_id?: string
          code?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          note?: string | null
          phone?: string | null
          staff_type?: Database["public"]["Enums"]["staff_type"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          note: string | null
          recorded_by: string
          staff_id: string
          status: Database["public"]["Enums"]["staff_attendance_status"]
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by: string
          staff_id: string
          status: Database["public"]["Enums"]["staff_attendance_status"]
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string
          staff_id?: string
          status?: Database["public"]["Enums"]["staff_attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      student_evaluations: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          enrollment_id: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by: string
          enrollment_id: string
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string
          enrollment_id?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          center_id: string
          code: string
          created_at: string
          full_name: string
          id: string
          note: string | null
          parent_name: string | null
          parent_phone: string | null
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          center_id: string
          code: string
          created_at?: string
          full_name: string
          id?: string
          note?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          center_id?: string
          code?: string
          created_at?: string
          full_name?: string
          id?: string
          note?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_center_id: { Args: never; Returns: string }
      current_staff_id: { Args: never; Returns: string }
      has_class_assignment: {
        Args: { p_class_id: string; p_on_date?: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      rpc_dashboard_summary: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: Json
      }
      rpc_deactivate_entity: {
        Args: { p_entity: string; p_id: string; p_trace_id?: string }
        Returns: Json
      }
      rpc_generate_sessions: {
        Args: { p_from_date: string; p_to_date: string; p_trace_id?: string }
        Returns: Json
      }
      rpc_link_staff_account: {
        Args: { p_staff_id: string; p_trace_id?: string; p_user_id: string }
        Returns: {
          active: boolean
          center_id: string
          created_at: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_record_financial_transaction: {
        Args: {
          p_amount: number
          p_category: string
          p_description: string
          p_trace_id?: string
          p_transaction_date: string
          p_transaction_id: string
          p_type: Database["public"]["Enums"]["financial_transaction_type"]
        }
        Returns: {
          amount: number
          category: string
          center_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          transaction_date: string
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_upsert_assignment: {
        Args: {
          p_active?: boolean
          p_assignment_id: string
          p_class_id: string
          p_end_date?: string
          p_role: Database["public"]["Enums"]["assignment_role"]
          p_staff_id: string
          p_start_date: string
          p_trace_id?: string
        }
        Returns: {
          active: boolean
          class_id: string
          created_at: string
          end_date: string | null
          id: string
          role: Database["public"]["Enums"]["assignment_role"]
          staff_id: string
          start_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_upsert_attendance: {
        Args: { p_items: Json; p_session_id: string; p_trace_id?: string }
        Returns: Json
      }
      rpc_upsert_class: {
        Args: {
          p_class_id: string
          p_code: string
          p_grade: number
          p_name: string
          p_note?: string
          p_status?: Database["public"]["Enums"]["entity_status"]
          p_subject: string
          p_trace_id?: string
        }
        Returns: {
          center_id: string
          code: string
          created_at: string
          grade: number
          id: string
          name: string
          note: string | null
          status: Database["public"]["Enums"]["entity_status"]
          subject: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_upsert_enrollment: {
        Args: {
          p_class_id: string
          p_enrolled_from: string
          p_enrolled_to?: string
          p_enrollment_id: string
          p_status?: string
          p_student_id: string
          p_trace_id?: string
        }
        Returns: {
          class_id: string
          created_at: string
          enrolled_from: string
          enrolled_to: string | null
          id: string
          status: string
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_upsert_evaluations: {
        Args: { p_items: Json; p_session_id: string; p_trace_id?: string }
        Returns: Json
      }
      rpc_upsert_schedule: {
        Args: {
          p_active?: boolean
          p_class_id: string
          p_end_time?: string
          p_schedule_id: string
          p_start_time?: string
          p_trace_id?: string
          p_weekday: number
        }
        Returns: {
          active: boolean
          class_id: string
          created_at: string
          end_time: string | null
          id: string
          start_time: string | null
          updated_at: string
          weekday: number
        }
        SetofOptions: {
          from: "*"
          to: "class_schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_upsert_staff: {
        Args: {
          p_code: string
          p_email?: string
          p_full_name: string
          p_note?: string
          p_phone?: string
          p_staff_id: string
          p_staff_type: Database["public"]["Enums"]["staff_type"]
          p_status?: Database["public"]["Enums"]["entity_status"]
          p_trace_id?: string
        }
        Returns: {
          center_id: string
          code: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          note: string | null
          phone: string | null
          staff_type: Database["public"]["Enums"]["staff_type"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "staff"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_upsert_staff_attendance: {
        Args: {
          p_attendance_date: string
          p_note?: string
          p_staff_id: string
          p_status: Database["public"]["Enums"]["staff_attendance_status"]
          p_trace_id?: string
        }
        Returns: {
          attendance_date: string
          created_at: string
          id: string
          note: string | null
          recorded_by: string
          staff_id: string
          status: Database["public"]["Enums"]["staff_attendance_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_upsert_student: {
        Args: {
          p_code: string
          p_full_name: string
          p_note?: string
          p_parent_name?: string
          p_parent_phone?: string
          p_phone?: string
          p_status?: Database["public"]["Enums"]["entity_status"]
          p_student_id: string
          p_trace_id?: string
        }
        Returns: {
          center_id: string
          code: string
          created_at: string
          full_name: string
          id: string
          note: string | null
          parent_name: string | null
          parent_phone: string | null
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      write_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_resource_id: string
          p_resource_type: string
          p_trace_id?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "ADMIN" | "STAFF"
      assignment_role: "TEACHER" | "ASSISTANT"
      attendance_status: "PRESENT" | "ABSENT" | "EXCUSED"
      entity_status: "ACTIVE" | "INACTIVE"
      financial_transaction_type: "INCOME" | "EXPENSE"
      session_status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
      staff_attendance_status: "PRESENT" | "ABSENT" | "LEAVE"
      staff_type: "TEACHER" | "ASSISTANT"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["ADMIN", "STAFF"],
      assignment_role: ["TEACHER", "ASSISTANT"],
      attendance_status: ["PRESENT", "ABSENT", "EXCUSED"],
      entity_status: ["ACTIVE", "INACTIVE"],
      financial_transaction_type: ["INCOME", "EXPENSE"],
      session_status: ["SCHEDULED", "COMPLETED", "CANCELLED"],
      staff_attendance_status: ["PRESENT", "ABSENT", "LEAVE"],
      staff_type: ["TEACHER", "ASSISTANT"],
    },
  },
} as const
