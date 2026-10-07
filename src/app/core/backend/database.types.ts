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
