/** 'auto' = generated menu hitting the kcal/protein targets; 'trainer' = fixed 7-day plan from the trainer. */
export type MenuMode = 'auto' | 'trainer';

export type Lang = 'az' | 'en' | 'ru';

/** 'system' follows the OS light/dark preference. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Color skin: only the accent colors change, each skin has a dark and a light variant (CSS `data-skin` in _skins.scss). */
export const SKINS = ['lime', 'ocean', 'violet', 'rose', 'amber', 'teal', 'orange', 'slate'] as const;

export type SkinId = (typeof SKINS)[number];

/** 'program' = built-in Full Body A/B with progression; 'trainer' = exercises the trainer gives, entered per week. */
export type WorkoutMode = 'program' | 'trainer';

export type Sex = 'male' | 'female';

/** `auto`: the calorie and protein targets are worked out from the body data and the goal; `custom`: the user types them. */
export type TargetMode = 'auto' | 'custom';

/** What the user wants from their weight: lose it, keep it, or gain it. */
export type Goal = 'lose' | 'maintain' | 'gain';

export interface Settings {
  /** cm, kg, years and sex; null until the user enters them (they differ per person, so there is no default). */
  height: number | null;
  startWeight: number | null;
  age: number | null;
  sex: Sex | null;
  goal: Goal;
  targetMode: TargetMode;
  kcalTarget: number;
  proteinTarget: number;
  mealsPerDay: number;
  useWhey: boolean;
  menuMode: MenuMode;
  workoutMode: WorkoutMode;
  theme: ThemeMode;
  skin: SkinId;
  /** The desktop sidebar is shown as a narrow icon rail. */
  sidebarCollapsed: boolean;
  lang: Lang;
  showCreatine: boolean;
  workoutTime: string;
  wakeTime: string;
  sleepTime: string;
  programStart: string;
  /** Local date key of the day the guest notice was closed; '' = never. It comes back after a week. */
  guestNoticeDismissedAt: string;
}
