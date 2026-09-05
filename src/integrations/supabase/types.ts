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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          checked_in_at: string
          checked_in_by: string | null
          event_id: string
          guest_id: string
          id: string
          method: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_by?: string | null
          event_id: string
          guest_id: string
          id?: string
          method?: string
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string | null
          event_id?: string
          guest_id?: string
          id?: string
          method?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          audience: string
          channel: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          message: string
          status: string
          title: string
        }
        Insert: {
          audience?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          message: string
          status?: string
          title: string
        }
        Update: {
          audience?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          message?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          event_id: string | null
          file_size: number
          file_type: string | null
          file_url: string
          id: string
          name: string
          organization_id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          file_size?: number
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          organization_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          file_size?: number
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          organization_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tables: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          floor_plan_id: string | null
          height: number
          id: string
          name: string
          position_x: number
          position_y: number
          rotation: number
          table_number: number | null
          table_type: Database["public"]["Enums"]["table_type"]
          width: number
        }
        Insert: {
          capacity?: number
          created_at?: string
          event_id: string
          floor_plan_id?: string | null
          height?: number
          id?: string
          name: string
          position_x?: number
          position_y?: number
          rotation?: number
          table_number?: number | null
          table_type?: Database["public"]["Enums"]["table_type"]
          width?: number
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          floor_plan_id?: string | null
          height?: number
          id?: string
          name?: string
          position_x?: number
          position_y?: number
          rotation?: number
          table_number?: number | null
          table_type?: Database["public"]["Enums"]["table_type"]
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number
          category: string
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string | null
          id: string
          name: string
          organization_id: string
          start_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          capacity?: number
          category?: string
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          name: string
          organization_id: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          capacity?: number
          category?: string
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plan_objects: {
        Row: {
          created_at: string
          floor_plan_id: string
          height: number
          id: string
          label: string
          object_type: string
          position_x: number
          position_y: number
          rotation: number
          width: number
        }
        Insert: {
          created_at?: string
          floor_plan_id: string
          height?: number
          id?: string
          label: string
          object_type?: string
          position_x?: number
          position_y?: number
          rotation?: number
          width?: number
        }
        Update: {
          created_at?: string
          floor_plan_id?: string
          height?: number
          id?: string
          label?: string
          object_type?: string
          position_x?: number
          position_y?: number
          rotation?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "floor_plan_objects_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plans: {
        Row: {
          background_locked: boolean
          background_opacity: number
          background_pdf_url: string | null
          created_at: string
          event_id: string
          height: number
          id: string
          name: string
          room_id: string | null
          width: number
        }
        Insert: {
          background_locked?: boolean
          background_opacity?: number
          background_pdf_url?: string | null
          created_at?: string
          event_id: string
          height?: number
          id?: string
          name?: string
          room_id?: string | null
          width?: number
        }
        Update: {
          background_locked?: boolean
          background_opacity?: number
          background_pdf_url?: string | null
          created_at?: string
          event_id?: string
          height?: number
          id?: string
          name?: string
          room_id?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_groups: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_relationships: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          related_guest_id: string
          relationship_type: string
          seating_preference: Database["public"]["Enums"]["seating_preference"]
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          related_guest_id: string
          relationship_type?: string
          seating_preference?: Database["public"]["Enums"]["seating_preference"]
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          related_guest_id?: string
          relationship_type?: string
          seating_preference?: Database["public"]["Enums"]["seating_preference"]
        }
        Relationships: [
          {
            foreignKeyName: "guest_relationships_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_relationships_related_guest_id_fkey"
            columns: ["related_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          accessibility_requirements: string | null
          avatar_url: string | null
          company: string | null
          created_at: string
          dietary_requirements: string | null
          email: string | null
          event_id: string
          first_name: string
          group_id: string | null
          id: string
          job_title: string | null
          last_name: string
          notes: string | null
          phone: string | null
          plus_ones: number
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          vip_status: boolean
        }
        Insert: {
          accessibility_requirements?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          dietary_requirements?: string | null
          email?: string | null
          event_id: string
          first_name: string
          group_id?: string | null
          id?: string
          job_title?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          plus_ones?: number
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          vip_status?: boolean
        }
        Update: {
          accessibility_requirements?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          dietary_requirements?: string | null
          email?: string | null
          event_id?: string
          first_name?: string
          group_id?: string | null
          id?: string
          job_title?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          plus_ones?: number
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          vip_status?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "guest_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          event_id: string
          guest_id: string
          id: string
          message: string | null
          opened_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_id: string
          id?: string
          message?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_id?: string
          id?: string
          message?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          plan: string
          primary_color: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          plan?: string
          primary_color?: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          plan?: string
          primary_color?: string
          slug?: string
        }
        Relationships: []
      }
      pdf_generations: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          file_url: string | null
          id: string
          organization_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          file_url?: string | null
          id?: string
          organization_id: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_generations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_generations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string | null
          guest_id: string | null
          id: string
          token: string
          type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at?: string | null
          guest_id?: string | null
          id?: string
          token?: string
          type?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string | null
          guest_id?: string | null
          id?: string
          token?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          id: string
          name: string
          venue_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          name: string
          venue_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          name?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_assignments: {
        Row: {
          assigned_at: string
          event_id: string
          guest_id: string
          id: string
          seat_id: string | null
          table_id: string
        }
        Insert: {
          assigned_at?: string
          event_id: string
          guest_id: string
          id?: string
          seat_id?: string | null
          table_id: string
        }
        Update: {
          assigned_at?: string
          event_id?: string
          guest_id?: string
          id?: string
          seat_id?: string | null
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_assignments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_assignments_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: true
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_assignments_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          created_at: string
          id: string
          position_x: number
          position_y: number
          seat_number: number
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position_x?: number
          position_y?: number
          seat_number: number
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position_x?: number
          position_y?: number
          seat_number?: number
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          capacity: number
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          address?: string | null
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          address?: string | null
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_event: { Args: { _event: string }; Returns: boolean }
      has_org_role: {
        Args: { _org: string; _role: Database["public"]["Enums"]["org_role"] }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
    }
    Enums: {
      event_status:
        | "draft"
        | "published"
        | "upcoming"
        | "live"
        | "completed"
        | "archived"
      invitation_status: "draft" | "sent" | "delivered" | "opened" | "confirmed"
      org_role: "owner" | "event_manager" | "event_staff"
      rsvp_status: "pending" | "confirmed" | "declined" | "maybe"
      seating_preference: "must_together" | "prefer_together" | "must_apart"
      table_type: "round" | "square" | "rectangle" | "custom"
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
      event_status: [
        "draft",
        "published",
        "upcoming",
        "live",
        "completed",
        "archived",
      ],
      invitation_status: ["draft", "sent", "delivered", "opened", "confirmed"],
      org_role: ["owner", "event_manager", "event_staff"],
      rsvp_status: ["pending", "confirmed", "declined", "maybe"],
      seating_preference: ["must_together", "prefer_together", "must_apart"],
      table_type: ["round", "square", "rectangle", "custom"],
    },
  },
} as const
