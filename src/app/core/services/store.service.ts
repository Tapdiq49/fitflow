import { Injectable, computed, inject, signal } from '@angular/core';
import { AppState, DayRecord, MenuMode, Settings, WorkoutMode, newDay } from '../../common/interfaces';
import { BodyIssue, KCAL_MAX, KCAL_MIN, PROTEIN_MAX, PROTEIN_MIN, bmiOf, bodyIssue } from '../targets';
import { DateU, clamp } from '../utils';
import { ToastService } from './toast.service';
import { t } from '../i18n/translate';

const STORAGE_KEY = 'fitflow.v1';

/** Bounds of the body measurements the user can enter (cm, kg). */
export const MIN_HEIGHT = 100;
export const MAX_HEIGHT = 250;
export const MIN_WEIGHT = 30;
export const MAX_WEIGHT = 300;

/** The numbers of the settings form are required and must lie in these ranges; the form reports a value outside instead of changing it. */
export const SETTINGS_RANGE = {
  height: { min: MIN_HEIGHT, max: MAX_HEIGHT },
  startWeight: { min: MIN_WEIGHT, max: MAX_WEIGHT },
  age: { min: 14, max: 90 },
  kcalTarget: { min: KCAL_MIN, max: KCAL_MAX },
  proteinTarget: { min: PROTEIN_MIN, max: PROTEIN_MAX },
} as const;

export const DEFAULT_SETTINGS: Omit<Settings, 'programStart'> = {
  height: null,
  startWeight: null,
  age: null,
  sex: null,
  goal: 'maintain',
  targetMode: 'auto',
  kcalTarget: 2700,
  proteinTarget: 180,
  mealsPerDay: 5,
  useWhey: true,
  menuMode: 'auto',
  workoutMode: 'program',
  theme: 'system',
  skin: 'lime',
  sidebarCollapsed: false,
  dir: 'ltr',
  navLayout: 'side',
  headerMode: 'fixed',
  fontScale: 'md',
  corners: 'medium',
  highContrast: false,
  timeFormat: '24h',
  dateFormat: 'text',
  lang: 'az',
  showCreatine: true,
  workoutTime: '18:00',
  wakeTime: '07:00',
  sleepTime: '23:30',
  guestNoticeDismissedAt: '',
};

/**
 * Single source of truth, persisted to LocalStorage.
 * Every mutation works on a deep copy so that all derived signals see new references.
 */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly toast = inject(ToastService);
  private readonly _state = signal<AppState>(StoreService.normalize(StoreService.read()));

  readonly state = this._state.asReadonly();
  readonly settings = computed(() => this._state().settings);
  /** Height, weight, age and sex are filled in; everything that depends on them (the menu, the calorie targets) waits for this. */
  readonly bodyBasicsKnown = computed(() => {
    const s = this.settings();
    return s.height != null && s.startWeight != null && s.age != null && s.sex != null;
  });

  /** Why no menu or calorie target may be shown (a minor, or a dangerously low BMI), judged on the newest weight; null when the body data is missing or fine. */
  readonly bodySafetyIssue = computed<BodyIssue | null>(() => {
    const s = this.settings();
    const kg = this.currentWeight();
    if (!this.bodyBasicsKnown() || kg == null) return null;
    return bodyIssue(s.height as number, kg, s.age as number);
  });
  /** The newest weight the user logged, else the starting weight from the settings; null while neither exists. */
  readonly currentWeight = computed<number | null>(() => {
    // A weight dated in the future (entered before that was refused) is not a measurement yet.
    const today = DateU.today();
    const latest = this._state().weights.reduce<{ date: string; kg: number } | null>((a, w) => (w.date > today || (a && a.date >= w.date) ? a : w), null);
    return latest?.kg ?? this.settings().startWeight;
  });
  /** BMI (one decimal) of the height and the current weight; null while either is missing. */
  readonly currentBmi = computed<number | null>(() => {
    const h = this.settings().height;
    const kg = this.currentWeight();
    return h == null || kg == null ? null : Math.round(bmiOf(h, kg) * 10) / 10;
  });
  /** The calorie and protein cards are shown only when the body data is complete and the app may advise this person. */
  readonly menuAllowed = computed(() => this.bodyBasicsKnown() && this.bodySafetyIssue() === null);
  /**
   * The menu mode in force. A person the app must not advise gets no generated menu: the trainer plan, which they write
   * themselves, is used whatever the setting says. Read this, never `settings().menuMode`, to decide how a menu is made.
   */
  readonly effectiveMenuMode = computed<MenuMode>(() => (this.bodySafetyIssue() ? 'trainer' : this.settings().menuMode));
  /** Same for the workout: such a person gets the trainer workout they write, not the built-in program. */
  readonly effectiveWorkoutMode = computed<WorkoutMode>(() => (this.bodySafetyIssue() ? 'trainer' : this.settings().workoutMode));

  static normalize(raw: unknown): AppState {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppState>;
    const settings: Settings = { ...DEFAULT_SETTINGS, programStart: '', ...(s.settings ?? {}) };
    if (!settings.programStart) settings.programStart = DateU.monday(DateU.today());
    for (const k of ['height', 'startWeight', 'age'] as const) if (typeof settings[k] !== 'number' || !(settings[k] > 0)) settings[k] = null;
    if (settings.sex !== 'male' && settings.sex !== 'female') settings.sex = null;
    // Settings saved before the targets could be automatic keep their typed numbers.
    if (s.settings && !('targetMode' in s.settings)) settings.targetMode = 'custom';
    if (settings.targetMode !== 'auto' && settings.targetMode !== 'custom') settings.targetMode = 'auto';
    if (settings.goal !== 'lose' && settings.goal !== 'maintain' && settings.goal !== 'gain') settings.goal = 'maintain';
    return {
      settings,
      foodCache: Array.isArray(s.foodCache) ? s.foodCache : [],
      workoutPlans: s.workoutPlans && typeof s.workoutPlans === 'object' ? s.workoutPlans : {},
      weekPlans: s.weekPlans && typeof s.weekPlans === 'object' ? s.weekPlans : {},
      days: s.days && typeof s.days === 'object' ? s.days : {},
      history: s.history && typeof s.history === 'object' ? s.history : {},
      weights: Array.isArray(s.weights) ? s.weights : [],
    };
  }

  private static read(): unknown {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  mutate(fn: (s: AppState) => void): void {
    const next = structuredClone(this._state());
    fn(next);
    this._state.set(next);
    this.persist();
  }

  /** Replaces the whole state with one that was already built (by `DataSyncService`, after the backend accepted it) and persists it. */
  apply(next: AppState): void {
    this._state.set(next);
    this.persist();
  }

  /**
   * Persists the settings form with the bounds the form promises. Past days that must keep the old times are frozen first
   * (`SettingsService.save`), because those day records live in the account.
   */
  updateSettings(f: Settings): void {
    this.mutate((s) => {
      s.settings = {
        ...f,
        height: f.height == null ? null : clamp(f.height, MIN_HEIGHT, MAX_HEIGHT),
        startWeight: f.startWeight == null ? null : clamp(f.startWeight, MIN_WEIGHT, MAX_WEIGHT),
        age: f.age == null ? null : clamp(Math.round(f.age), SETTINGS_RANGE.age.min, SETTINGS_RANGE.age.max),
        kcalTarget: clamp(f.kcalTarget, SETTINGS_RANGE.kcalTarget.min, SETTINGS_RANGE.kcalTarget.max),
        proteinTarget: clamp(f.proteinTarget, SETTINGS_RANGE.proteinTarget.min, SETTINGS_RANGE.proteinTarget.max),
        mealsPerDay: clamp(Math.round(f.mealsPerDay), 3, 6),
        programStart: DateU.monday(f.programStart),
      };
    });
  }

  setUseWhey(on: boolean): void {
    this.mutate((s) => (s.settings.useWhey = on));
  }

  mutateDay(k: string, fn: (d: DayRecord, s: AppState) => void): void {
    this.mutate((s) => fn((s.days[k] ??= newDay()), s));
  }

  peek(k: string): DayRecord | null {
    return this._state().days[k] ?? null;
  }

  /** Replaces all data (import). Throws when the payload is not a FitFlow backup. */
  replace(raw: unknown): void {
    if (!raw || typeof raw !== 'object' || !('days' in raw)) throw new Error('Invalid backup');
    this._state.set(StoreService.normalize(raw));
    this.persist();
  }

  reset(): void {
    this._state.set(StoreService.normalize(null));
    this.persist();
  }

  exportJson(): string {
    return JSON.stringify(this._state(), null, 2);
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state()));
    } catch {
      this.toast.show(t('core.couldNotSaveLocalstorage'));
    }
  }
}
