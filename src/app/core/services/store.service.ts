import { Injectable, computed, inject, signal } from '@angular/core';
import { AppState, DayRecord, Settings, newDay } from '../models';
import { DateU, clamp } from '../utils';
import { ToastService } from './toast.service';
import { t } from '../i18n/translate';

const STORAGE_KEY = 'fitflow.v1';

export const DEFAULT_SETTINGS: Omit<Settings, 'programStart'> = {
  height: 186,
  startWeight: 99,
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

  static normalize(raw: unknown): AppState {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppState>;
    const settings: Settings = { ...DEFAULT_SETTINGS, programStart: '', ...(s.settings ?? {}) };
    if (!settings.programStart) settings.programStart = DateU.monday(DateU.today());
    return {
      settings,
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
        kcalTarget: clamp(f.kcalTarget, 1500, 4500),
        proteinTarget: clamp(f.proteinTarget, 80, 300),
        mealsPerDay: clamp(Math.round(f.mealsPerDay), 4, 6),
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
