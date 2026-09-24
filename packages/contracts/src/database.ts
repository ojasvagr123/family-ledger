export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: string
          actual_balance_minor: number | null
          archived_at: string | null
          beginning_balance_minor: number
          created_at: string
          created_by: string
          display_credit_as_positive: boolean
          family_id: string
          id: string
          institution: string | null
          name: string
          normalized_name: string | null
          opening_date: string
          sort_order: number
          last_checked_date: string | null
          updated_at: string
          version: number
        }
        Insert: {
          account_type?: string
          actual_balance_minor?: number | null
          archived_at?: string | null
          beginning_balance_minor?: number
          created_at?: string
          created_by: string
          display_credit_as_positive?: boolean
          family_id: string
          id?: string
          institution?: string | null
          name: string
          normalized_name?: string | null
          opening_date: string
          sort_order?: number
          last_checked_date?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          account_type?: string
          actual_balance_minor?: number | null
          archived_at?: string | null
          beginning_balance_minor?: number
          created_at?: string
          created_by?: string
          display_credit_as_positive?: boolean
          family_id?: string
          id?: string
          institution?: string | null
          name?: string
          normalized_name?: string | null
          opening_date?: string
          sort_order?: number
          last_checked_date?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      account_reconciliations: {
        Row: {
          account_id: string
          actual_balance_minor: number
          checked_on: string
          created_at: string
          created_by: string
          difference_minor: number
          expected_balance_minor: number
          family_id: string
          id: string
        }
        Insert: {
          account_id: string
          actual_balance_minor: number
          checked_on: string
          created_at?: string
          created_by: string
          difference_minor: number
          expected_balance_minor: number
          family_id: string
          id?: string
        }
        Update: {
          account_id?: string
          actual_balance_minor?: number
          checked_on?: string
          created_at?: string
          created_by?: string
          difference_minor?: number
          expected_balance_minor?: number
          family_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_reconciliations_family_id_account_id_fkey"
            columns: ["family_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "account_reconciliations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          family_id: string
          id: number
          request_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          family_id: string
          id?: never
          request_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          family_id?: string
          id?: never
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string
          family_id: string
          id: string
          name: string
          normalized_name: string | null
          sort_order: number
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          name: string
          normalized_name?: string | null
          sort_order?: number
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          name?: string
          normalized_name?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          currency_code: string
          currency_symbol: string
          fiscal_start_month: number
          id: string
          name: string
          notes: string
          notes_updated_at: string | null
          notes_updated_by: string | null
          owner_user_id: string
          reporting_start_year: number
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          fiscal_start_month?: number
          id?: string
          name: string
          notes?: string
          notes_updated_at?: string | null
          notes_updated_by?: string | null
          owner_user_id: string
          reporting_start_year: number
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          fiscal_start_month?: number
          id?: string
          name?: string
          notes?: string
          notes_updated_at?: string | null
          notes_updated_by?: string | null
          owner_user_id?: string
          reporting_start_year?: number
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      family_members: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          family_id: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          family_id: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          family_id?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          operation: string
          request_hash: string
          response: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          operation: string
          request_hash: string
          response?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          operation?: string
          request_hash?: string
          response?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          family_id: string
          file_sha256: string | null
          filename: string
          id: string
          imported_rows: number
          mapping: Json
          rolled_back_at: string | null
          skipped_rows: number
          status: string
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          family_id: string
          file_sha256?: string | null
          filename: string
          id?: string
          imported_rows?: number
          mapping?: Json
          rolled_back_at?: string | null
          skipped_rows?: number
          status?: string
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          family_id?: string
          file_sha256?: string | null
          filename?: string
          id?: string
          imported_rows?: number
          mapping?: Json
          rolled_back_at?: string | null
          skipped_rows?: number
          status?: string
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          family_id: string
          id: string
          max_uses: number
          revoked_at: string | null
          token_hash: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          family_id: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          token_hash: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          family_id?: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          token_hash?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          family_id: string
          id: string
          invitation_id: string
          status: Database["public"]["Enums"]["join_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          family_id: string
          id?: string
          invitation_id: string
          status?: Database["public"]["Enums"]["join_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          family_id?: string
          id?: string
          invitation_id?: string
          status?: Database["public"]["Enums"]["join_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_family_id_invitation_id_fkey"
            columns: ["family_id", "invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_type: string
          family_id: string
          id: string
          read_at: string | null
          recipient_user_id: string
          route: string | null
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          event_type: string
          family_id: string
          id?: string
          read_at?: string | null
          recipient_user_id: string
          route?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          event_type?: string
          family_id?: string
          id?: string
          read_at?: string | null
          recipient_user_id?: string
          route?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          locale: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          locale?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          locale?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount_minor: number
          category_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string
          family_id: string
          id: string
          import_batch_id: string | null
          import_fingerprint: string | null
          import_row_number: number | null
          local_date: string
          paid_by_user_id: string | null
          received_by_user_id: string | null
          remarks: string
          transfer_group_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          account_id: string
          amount_minor: number
          category_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string
          family_id: string
          id?: string
          import_batch_id?: string | null
          import_fingerprint?: string | null
          import_row_number?: number | null
          local_date: string
          paid_by_user_id?: string | null
          received_by_user_id?: string | null
          remarks?: string
          transfer_group_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          account_id?: string
          amount_minor?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string
          family_id?: string
          id?: string
          import_batch_id?: string | null
          import_fingerprint?: string | null
          import_row_number?: number | null
          local_date?: string
          paid_by_user_id?: string | null
          received_by_user_id?: string | null
          remarks?: string
          transfer_group_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_family_id_account_id_fkey"
            columns: ["family_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "transactions_family_id_category_id_fkey"
            columns: ["family_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_idempotent: {
        Args: { p_key: string; p_operation: string; p_request: Json }
        Returns: Json
      }
      begin_import_batch: {
        Args: {
          p_family_id: string
          p_filename: string
          p_file_sha256: string
          p_idempotency_key: string
          p_mapping: Json
          p_total_rows: number
        }
        Returns: Json
      }
      create_account: {
        Args: {
          p_account_type: string
          p_balance_minor: string
          p_family_id: string
          p_idempotency_key: string
          p_name: string
          p_opening_date: string
        }
        Returns: Json
      }
      create_account_extended: {
        Args: {
          p_account_type: string
          p_balance_minor: string
          p_display_credit_as_positive: boolean
          p_family_id: string
          p_idempotency_key: string
          p_institution: string
          p_name: string
          p_opening_date: string
          p_sort_order: number
        }
        Returns: Json
      }
      create_account_transfer: {
        Args: {
          p_amount_minor: string
          p_description: string
          p_family_id: string
          p_from_account_id: string
          p_idempotency_key: string
          p_local_date: string
          p_remarks: string
          p_to_account_id: string
        }
        Returns: Json
      }
      create_category_extended: {
        Args: {
          p_color: string
          p_family_id: string
          p_idempotency_key: string
          p_name: string
          p_type: Database["public"]["Enums"]["category_type"]
        }
        Returns: Json
      }
      create_demo_family: {
        Args: { p_idempotency_key: string }
        Returns: Json
      }
      create_family: {
        Args: {
          p_currency_code: string
          p_currency_symbol: string
          p_fiscal_start_month: number
          p_idempotency_key: string
          p_name: string
          p_reporting_start_year: number
          p_timezone: string
        }
        Returns: Json
      }
      create_invitation: {
        Args: {
          p_expires_in_hours: number
          p_family_id: string
          p_idempotency_key: string
          p_max_uses: number
        }
        Returns: Json
      }
      decide_join_request: {
        Args: {
          p_decision: Database["public"]["Enums"]["join_request_status"]
          p_family_id: string
          p_idempotency_key: string
          p_join_request_id: string
        }
        Returns: Json
      }
      delete_unused_category: {
        Args: {
          p_category_id: string
          p_family_id: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      finish_import_batch: {
        Args: {
          p_batch_id: string
          p_cancelled: boolean
          p_family_id: string
        }
        Returns: Json
      }
      finish_idempotent: {
        Args: { p_key: string; p_operation: string; p_response: Json }
        Returns: undefined
      }
      has_family_role: {
        Args: {
          p_family_id: string
          p_roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      get_family_notes: { Args: { p_family_id: string }; Returns: Json }
      get_my_profile: { Args: never; Returns: Json }
      import_batch_transaction: {
        Args: {
          p_account_id: string
          p_amount_minor: string
          p_batch_id: string
          p_category_id: string
          p_description: string
          p_family_id: string
          p_fingerprint: string
          p_idempotency_key: string
          p_local_date: string
          p_remarks: string
          p_row_number: number
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: Json
      }
      inspect_invitation: { Args: { p_token: string }; Returns: Json }
      is_active_member: { Args: { p_family_id: string }; Returns: boolean }
      leave_family: {
        Args: { p_family_id: string; p_idempotency_key: string }
        Returns: Json
      }
      ledger_json: {
        Args: { p_row: Database["public"]["Tables"]["transactions"]["Row"] }
        Returns: Json
      }
      list_accounts: { Args: { p_family_id: string }; Returns: Json }
      list_account_reconciliations: {
        Args: { p_account_id: string; p_family_id: string }
        Returns: Database["public"]["Tables"]["account_reconciliations"]["Row"][]
      }
      list_family_members: {
        Args: { p_family_id: string }
        Returns: {
          display_name: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }[]
      }
      list_my_families: {
        Args: never
        Returns: {
          currency_code: string
          currency_symbol: string
          fiscal_start_month: number
          id: string
          name: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          timezone: string
          version: number
        }[]
      }
      list_import_batches: {
        Args: { p_family_id: string }
        Returns: Database["public"]["Tables"]["import_batches"]["Row"][]
      }
      list_my_notifications: {
        Args: { p_limit?: number }
        Returns: Database["public"]["Tables"]["notifications"]["Row"][]
      }
      list_pending_join_requests: {
        Args: { p_family_id: string }
        Returns: {
          created_at: string
          family_id: string
          id: string
          requester_display_name: string
          requester_user_id: string
          status: Database["public"]["Enums"]["join_request_status"]
        }[]
      }
      list_transactions: {
        Args: {
          p_account_id?: string
          p_category_id?: string
          p_cursor_date?: string
          p_cursor_id?: string
          p_end?: string
          p_family_id: string
          p_limit?: number
          p_member_id?: string
          p_start?: string
          p_type?: string
        }
        Returns: Json
      }
      monthly_report: {
        Args: { p_family_id: string; p_month: number; p_year: number }
        Returns: Json
      }
      mark_notification_read: {
        Args: { p_notification_id: string; p_read?: boolean }
        Returns: Json
      }
      merge_categories: {
        Args: {
          p_family_id: string
          p_idempotency_key: string
          p_source_category_id: string
          p_target_category_id: string
        }
        Returns: Json
      }
      preview_import_duplicates: {
        Args: { p_family_id: string; p_fingerprints: string[] }
        Returns: string[]
      }
      remove_family_member: {
        Args: {
          p_family_id: string
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: Json
      }
      request_join: {
        Args: { p_idempotency_key: string; p_token: string }
        Returns: Json
      }
      revoke_invitation: {
        Args: {
          p_family_id: string
          p_idempotency_key: string
          p_invitation_id: string
        }
        Returns: Json
      }
      rollback_import_batch: {
        Args: {
          p_batch_id: string
          p_family_id: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      save_transaction: {
        Args: {
          p_account_id: string
          p_amount_minor: string
          p_category_id: string
          p_description: string
          p_expected_version: number
          p_family_id: string
          p_idempotency_key: string
          p_local_date: string
          p_remarks: string
          p_transaction_id: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: Json
      }
      save_transaction_v2: {
        Args: {
          p_account_id: string
          p_amount_minor: string
          p_category_id: string
          p_description: string
          p_expected_version: number
          p_family_id: string
          p_idempotency_key: string
          p_local_date: string
          p_related_user_id: string
          p_remarks: string
          p_transaction_id: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: Json
      }
      search_transactions_v2: {
        Args: {
          p_account_id?: string
          p_category_id?: string
          p_deleted_status?: string
          p_end?: string
          p_family_id: string
          p_limit?: number
          p_max_amount_minor?: string
          p_member_id?: string
          p_min_amount_minor?: string
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_start?: string
          p_type?: string
        }
        Returns: Json
      }
      set_family_member_status: {
        Args: {
          p_family_id: string
          p_idempotency_key: string
          p_status: Database["public"]["Enums"]["member_status"]
          p_user_id: string
        }
        Returns: Json
      }
      set_transaction_deleted: {
        Args: {
          p_deleted: boolean
          p_expected_version: number
          p_family_id: string
          p_idempotency_key: string
          p_transaction_id: string
        }
        Returns: Json
      }
      transfer_family_ownership: {
        Args: {
          p_family_id: string
          p_idempotency_key: string
          p_new_owner_user_id: string
        }
        Returns: Json
      }
      update_account_extended: {
        Args: {
          p_account_id: string
          p_account_type: string
          p_display_credit_as_positive: boolean
          p_family_id: string
          p_idempotency_key: string
          p_institution: string
          p_name: string
          p_sort_order: number
        }
        Returns: Json
      }
      update_category_extended: {
        Args: {
          p_category_id: string
          p_color: string
          p_family_id: string
          p_idempotency_key: string
          p_name: string
          p_sort_order: number
        }
        Returns: Json
      }
      update_family_notes: {
        Args: {
          p_expected_version: number
          p_family_id: string
          p_idempotency_key: string
          p_notes: string
        }
        Returns: Json
      }
      update_my_profile: {
        Args: {
          p_avatar_url: string
          p_display_name: string
          p_idempotency_key: string
          p_locale: string
          p_timezone: string
        }
        Returns: Json
      }
    }
    Enums: {
      category_type: "INCOME" | "EXPENSE"
      join_request_status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
      member_role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
      member_status:
        | "PENDING"
        | "ACTIVE"
        | "REJECTED"
        | "SUSPENDED"
        | "LEFT"
        | "REMOVED"
      transaction_type: "INCOME" | "EXPENSE" | "ADJUSTMENT"
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
      category_type: ["INCOME", "EXPENSE"],
      join_request_status: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      member_role: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
      member_status: [
        "PENDING",
        "ACTIVE",
        "REJECTED",
        "SUSPENDED",
        "LEFT",
        "REMOVED",
      ],
      transaction_type: ["INCOME", "EXPENSE", "ADJUSTMENT"],
    },
  },
} as const
