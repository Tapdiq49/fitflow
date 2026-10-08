import { Injectable, computed, inject } from '@angular/core';
import { Advice, BodyStats, Sex, WeightEntry } from '../../common/interfaces';
import { bmiOf, plausibleBody } from '../targets';
import { DateU, F, rnd } from '../utils';
import { MAX_HEIGHT, MAX_WEIGHT, MIN_HEIGHT, MIN_WEIGHT, SETTINGS_RANGE, StoreService } from './store.service';
import { ToastService } from './toast.service';
import { t } from '../i18n/translate';

@Injectable({ providedIn: 'root' })
export class BodyService {
  private readonly store = inject(StoreService);
  private readonly toast = inject(ToastService);

  readonly sorted = computed(() => [...this.store.state().weights].sort((a, b) => a.date.localeCompare(b.date)));
  /** Newest weight, else the starting weight; null while the user has entered neither. */
  readonly latestKg = computed(() => this.store.currentWeight());

  stats(ref: string): BodyStats | null {
    const all = this.sorted();
    if (!all.length) return null;
    const upto = all.filter((w) => w.date <= ref);
    const list = upto.length ? upto : all;
    const first = all[0];
    const cur = list[list.length - 1];
    const span = (a: number, b: number): WeightEntry[] =>
      list.filter((w) => {
        const dd = DateU.diffDays(w.date, cur.date);
        return dd >= a && dd < b;
      });
    const avg = (arr: WeightEntry[]): number | null => (arr.length ? arr.reduce((s, w) => s + w.kg, 0) / arr.length : null);
    const avg7 = avg(span(0, 7));
    const prev7 = avg(span(7, 14));
    let rate: number | null = null;
    if (avg7 != null && prev7 != null) rate = avg7 - prev7;
    else {
      const d = DateU.diffDays(first.date, cur.date);
      if (d >= 6) rate = ((cur.kg - first.kg) / d) * 7;
    }
    const waists = list.filter((w) => w.waist);
    return {
      first,
      cur,
      today: all.find((w) => w.date === ref) ?? null,
      avg7,
      rate,
      change: cur.kg - first.kg,
      waistFirst: waists[0]?.waist ?? null,
      waistCur: waists.at(-1)?.waist ?? null,
    };
  }

  advice(st: BodyStats | null): Advice {
    if (!st || st.rate == null) {
      return { level: 'info', text: t('bodySvc.atLeastOneWeek') };
    }
    if (st.rate > 0.5) {
      return { level: 'warn', text: t('bodySvc.weightRisingTooFast', { r: F.signed(st.rate) }), delta: -150 };
    }
    if (st.rate < -0.5) {
      return { level: 'warn', text: t('bodySvc.weightDroppingTooFast', { r: F.signed(st.rate) }), delta: 150 };
    }
    if (st.waistCur && st.waistFirst && st.waistCur - st.waistFirst >= 2 && st.change > 0) {
      return {
        level: 'warn',
        text: t('bodySvc.waistIncreasedByN', { d: F.signed(st.waistCur - st.waistFirst) }),
        delta: -100,
      };
    }
    return { level: 'good', text: t('bodySvc.paceFineNKg', { r: F.signed(st.rate) }) };
  }

  /** Saves the height (cm), starting weight (kg), age and sex the user typed; false (with a message) when they are not usable. */
  saveBasics(height: number, weight: number, age: number, sex: Sex | null): boolean {
    const { min, max } = SETTINGS_RANGE.age;
    if (!(height >= MIN_HEIGHT && height <= MAX_HEIGHT) || !(weight >= MIN_WEIGHT && weight <= MAX_WEIGHT) || !(age >= min && age <= max) || !sex) {
      this.toast.show(t('bodyBasics.invalid', { h1: MIN_HEIGHT, h2: MAX_HEIGHT, w1: MIN_WEIGHT, w2: MAX_WEIGHT, a1: min, a2: max }));
      return false;
    }
    if (!plausibleBody(height, weight)) {
      this.toast.show(t('bodyBasics.implausible', { bmi: Math.round(bmiOf(height, weight)) }));
      return false;
    }
    this.store.mutate((s) => {
      s.settings.height = rnd(height, 0);
      s.settings.startWeight = rnd(weight, 1);
      s.settings.age = Math.round(age);
      s.settings.sex = sex;
    });
    return true;
  }

  save(date: string, kg: number, waist: number): boolean {
    if (date > DateU.today()) {
      this.toast.show(t('bodySvc.noFutureDate'));
      return false;
    }
    if (!(kg > 30 && kg < 300)) {
      this.toast.show(t('bodySvc.enterValidWeight'));
      return false;
    }
    const height = this.store.settings().height;
    if (height != null && !plausibleBody(height, kg)) {
      this.toast.show(t('bodyBasics.implausible', { bmi: Math.round(bmiOf(height, kg)) }));
      return false;
    }
    this.store.mutate((s) => {
      s.weights = s.weights.filter((w) => w.date !== date);
      s.weights.push({ date, kg: rnd(kg, 1), waist: waist > 40 && waist < 200 ? rnd(waist, 1) : null });
    });
    this.toast.show(t('bodySvc.weightSaved'));
    return true;
  }

  remove(date: string): void {
    this.store.mutate((s) => (s.weights = s.weights.filter((w) => w.date !== date)));
  }
}
