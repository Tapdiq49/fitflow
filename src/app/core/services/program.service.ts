import { Injectable, inject } from '@angular/core';
import { DayType, Phase, Variant } from '../models';
import { DateU } from '../utils';
import { StoreService } from './store.service';
import { DEFAULT_GYM_DAYS, TrainerPlanService } from './trainer-plan.service';
import { td } from '../i18n/translate';

const TYPE_LABELS: Record<DayType, string> = { training: 'Məşq günü', cardio: 'Kardio günü', rest: 'Bərpa günü' };

/**
 * Weekly schedule: Mon/Wed/Fri gym (A/B alternating by week), Tue/Thu cardio, weekend recovery.
 * In trainer mode the gym days are the ones chosen in that week's workout plan; other weekdays are cardio, weekends recovery.
 */
@Injectable({ providedIn: 'root' })
export class ProgramService {
  private readonly store = inject(StoreService);
  private readonly plans = inject(TrainerPlanService);

  private isTrainer(): boolean {
    return this.store.settings().workoutMode === 'trainer';
  }

  dayType(k: string): DayType {
    const d = DateU.dow(k);
    const gym = this.isTrainer() ? this.plans.gymDays(DateU.monday(k)) : DEFAULT_GYM_DAYS;
    if (gym.includes(d)) return 'training';
    return d <= 5 ? 'cardio' : 'rest';
  }

  typeLabel(type: DayType): string {
    return td(TYPE_LABELS[type]);
  }

  weekIndex(k: string): number {
    return Math.floor(DateU.diffDays(DateU.monday(this.store.settings().programStart), DateU.monday(k)) / 7);
  }

  /** Week 1: A-B-A, week 2: B-A-B, and so on. Null on non-gym days. */
  variant(k: string): Variant | null {
    if (this.isTrainer()) return this.dayType(k) === 'training' ? 'A' : null;
    const pos = ({ 1: 0, 3: 1, 5: 2 } as Record<number, number>)[DateU.dow(k)];
    if (pos === undefined) return null;
    const even = ((this.weekIndex(k) % 2) + 2) % 2 === 0;
    return (even ? (['A', 'B', 'A'] as const) : (['B', 'A', 'B'] as const))[pos];
  }

  variantOf(k: string): Variant {
    return this.variant(k) ?? 'A';
  }

  /** Gradual loading after varicocele surgery. */
  phase(k: string): Phase {
    const wk = Math.max(1, this.weekIndex(k) + 1);
    if (wk <= 2) return { n: 1, wk, name: 'Faza 1 · Adaptasiya', rir: '3–4', text: 'Texnika və adaptasiya. Hər setdə 3–4 təkrar ehtiyat saxla. Ağır squat/deadlift yox.' };
    if (wk <= 4) return { n: 2, wk, name: 'Faza 2 · Tədrici yüklənmə', rir: '2–3', text: 'Çəkini kiçik addımlarla artır. Hər setdə 2–3 təkrar ehtiyat saxla.' };
    return { n: 3, wk, name: 'Faza 3 · Progressiv yüklənmə', rir: '1–2', text: 'Double progression: təkrar diapazonunun yuxarısına çatanda çəkini artır. Failure-a getmə.' };
  }

  nextTraining(k: string): string | null {
    for (let i = 1; i <= 7; i++) {
      const d = DateU.add(k, i);
      if (this.dayType(d) === 'training') return d;
    }
    return null;
  }
}
