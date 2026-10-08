/** 'auto' = generated menu hitting the kcal/protein targets; 'trainer' = fixed 7-day plan from the trainer. */
export type MenuMode = 'auto' | 'trainer';

export type Lang = 'az' | 'en' | 'ru';

/** 'system' follows the OS light/dark preference. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Color skin: only the accent colors change, each skin has a dark and a light variant (CSS `data-skin` in _skins.scss). */
export const SKINS = ['lime', 'ocean', 'violet', 'rose', 'amber', 'teal', 'orange', 'slate'] as const;

export type SkinId = (typeof SKINS)[number];

/** Text direction of the whole app (RTL flips the layout). */
export type Direction = 'ltr' | 'rtl';

/** Where the navigation sits: classic sidebar, floating sidebar card, a bar on top, or a dock at the bottom. */
export const NAV_LAYOUTS = ['side', 'floating', 'top', 'dock'] as const;
export type NavLayout = (typeof NAV_LAYOUTS)[number];

/** Text size of the whole app: scales the root font size. */
export const FONT_SCALES = ['sm', 'md', 'lg'] as const;
export type FontScale = (typeof FONT_SCALES)[number];

/** How round the corners of cards, fields and buttons are. */
export const CORNERS = ['sharp', 'medium', 'round'] as const;
export type Corners = (typeof CORNERS)[number];

/** Clock shown as 13:30 or 1:30 PM. */
export const TIME_FORMATS = ['24h', '12h'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

/** Date shown as text (6 October 2026), 06.10.2026 or 10/06/2026. */
export const DATE_FORMATS = ['text', 'dmy', 'mdy'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

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
  dir: Direction;
  navLayout: NavLayout;
  fontScale: FontScale;
  corners: Corners;
  highContrast: boolean;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  lang: Lang;
  showCreatine: boolean;
  workoutTime: string;
  wakeTime: string;
  sleepTime: string;
  programStart: string;
  /** Local date key of the day the guest notice was closed; '' = never. It comes back after a week. */
  guestNoticeDismissedAt: string;
}
