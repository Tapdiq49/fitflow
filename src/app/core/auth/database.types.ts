/** Typed view of the Supabase schema (supabase/migrations). Regenerate with `supabase gen types typescript` after schema changes. */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          email: string;
          email_preferences: boolean;
          avatar: string | null;
          created_at: string;
          updated_at: string;
        };
        /** Rows are created by the database trigger only. */
        Insert: never;
        Update: {
          username?: string | null;
          email_preferences?: boolean;
          avatar?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
