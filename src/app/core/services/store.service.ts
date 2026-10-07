import { Injectable, computed, inject, signal } from '@angular/core';
import { AppState, DayRecord, Settings, newDay } from '../models';
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
  kcalTarget: { min: 1500, max: 4500 },
  proteinTarget: { min: 80, max: 300 },
} as const;

export const DEFAULT_SETTINGS: Omit<Settings, 'programStart'> = {
  height: null,
  startWeight: null,
  kcalTarget: 2700,
  proteinTarget: 180,
  mealsPerDay: 5,
  useWhey: true,
  menuMode: 'trainer',
  workoutMode: 'program',
  theme: 'system',
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
  /** Height and weight are filled in; everything that depends on them waits for this. */
  readonly bodyBasicsKnown = computed(() => this.settings().height != null && this.settings().startWeight != null);

  static normalize(raw: unknown): AppState {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppState>;
    const settings: Settings = { ...DEFAULT_SETTINGS, programStart: '', ...(s.settings ?? {}) };
    if (!settings.programStart) settings.programStart = DateU.monday(DateU.today());
    for (const k of ['height', 'startWeight'] as const) if (typeof settings[k] !== 'number' || !(settings[k] > 0)) settings[k] = null;
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

  /** Persists the settings form with the bounds the form promises. */
  updateSettings(f: Settings): void {
    this.mutate((s) => {
      // Freeze past days with the settings they were lived under before the change applies.
      const { workoutTime, wakeTime, sleepTime, showCreatine } = s.settings;
      const today = DateU.today();
      for (const [k, d] of Object.entries(s.days)) if (k < today && !d.snap) d.snap = { workoutTime, wakeTime, sleepTime, showCreatine };
      s.settings = {
        ...f,
        height: f.height == null ? null : clamp(f.height, MIN_HEIGHT, MAX_HEIGHT),
        startWeight: f.startWeight == null ? null : clamp(f.startWeight, MIN_WEIGHT, MAX_WEIGHT),
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
