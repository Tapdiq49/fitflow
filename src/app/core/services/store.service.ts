import { Injectable, computed, inject, signal } from '@angular/core';
import { AppState, DayRecord, Settings, newDay } from '../models';
import { DateU } from '../utils';
import { ToastService } from './toast.service';

const STORAGE_KEY = 'fitflow.v1';

export const DEFAULT_SETTINGS: Omit<Settings, 'programStart'> = {
  height: 186,
  startWeight: 99,
  kcalTarget: 2700,
  proteinTarget: 180,
  mealsPerDay: 5,
  useWhey: true,
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
      days: s.days && typeof s.days === 'object' ? s.days : {},
      history: s.history && typeof s.history === 'object' ? s.history : {},
      weights: Array.isArray(s.weights) ? s.weights : [],
      bloat: Array.isArray(s.bloat) ? s.bloat : [],
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
      this.toast.show('Yadda saxlamaq alınmadı (LocalStorage dolu ola bilər)');
    }
  }
}
