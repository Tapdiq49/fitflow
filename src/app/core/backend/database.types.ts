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
          /** cm and kg; null = not entered yet. */
          height_cm: number | null;
          start_weight_kg: number | null;
          age: number | null;
          sex: 'male' | 'female' | null;
          /** The settings that differ from the app's defaults; null = nothing saved yet. */
          settings: Record<string, unknown> | null;
          /** Changed by the admin-users Edge Function only (no column grant for users). */
          role_id: string;
          created_at: string;
          updated_at: string;
        };
        /** Rows are created by the database trigger only. */
        Insert: never;
        Update: {
          username?: string | null;
          email_preferences?: boolean;
          avatar?: string | null;
          height_cm?: number | null;
          start_weight_kg?: number | null;
          age?: number | null;
          sex?: 'male' | 'female' | null;
          settings?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
      permissions: {
        Row: { id: string; module: string; action: string; sort: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      roles: {
        Row: { id: string; name: string; description: string; is_system: boolean; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      role_permissions: {
        Row: { role_id: string; permission_id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      trainer_plans: {
        Row: {
          user_id: string;
          kind: 'meal' | 'workout';
          /** Monday of the week the plan starts in (YYYY-MM-DD). */
          week: string;
          plan: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          kind: 'meal' | 'workout';
          week: string;
          plan: Record<string, unknown>;
        };
        Update: {
          plan?: Record<string, unknown>;
        };
        Relationships: [];
      };
      days: {
        Row: {
          user_id: string;
          /** Local calendar day (YYYY-MM-DD). */
          day: string;
          /** The app's DayRecord. */
          record: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        /** Written through the function apply_user_data only. */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      weights: {
        Row: { user_id: string; day: string; kg: number; waist: number | null; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      exercise_history: {
        Row: { user_id: string; exercise_id: string; day: string; sets: { w: number; r: number }[]; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      foods: {
        Row: {
          id: string;
          /** Null = system food. */
          user_id: string | null;
          /** Stable key of a system food; null for user foods. */
          code: string | null;
          names: Record<string, string>;
          unit: 'g' | 'piece' | 'scoop';
          kcal: number;
          protein: number;
          carbs: number;
          fat: number;
          /** Menu generator fields: set on system foods, null on user foods. */
          role: 'protein' | 'carb' | 'fat' | 'fruit' | 'veg' | 'dairy' | 'supp' | null;
          step: number | null;
          min_amount: number | null;
          max_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          names: Record<string, string>;
          unit: 'g' | 'piece' | 'scoop';
          kcal: number;
          protein: number;
          carbs: number;
          fat: number;
        };
        Update: {
          names?: Record<string, string>;
          unit?: 'g' | 'piece' | 'scoop';
          kcal?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      /** `foods` plus the current visitor's own place in the list (food_order); null = not placed. */
      food_list: {
        Row: Database['public']['Tables']['foods']['Row'] & { position: number | null };
        Relationships: [];
      };
    };
    Functions: {
      apply_user_data: {
        /** One transaction for one change of days / weights / history; the shape is documented in supabase/migrations/..._user_data.sql. */
        Args: { p_changes: Record<string, unknown> };
        Returns: undefined;
      };
      move_food: {
        Args: { p_id: string; p_target: string };
        Returns: undefined;
      };
      is_username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
