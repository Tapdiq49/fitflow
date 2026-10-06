import { Injectable, computed, inject } from '@angular/core';
import { Advice, BodyStats, WeightEntry } from '../models';
import { DateU, F, rnd } from '../utils';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class BodyService {
  private readonly store = inject(StoreService);
  private readonly toast = inject(ToastService);

  readonly sorted = computed(() => [...this.store.state().weights].sort((a, b) => a.date.localeCompare(b.date)));
  readonly latestKg = computed(() => this.sorted().at(-1)?.kg ?? this.store.settings().startWeight);

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
      return { level: 'info', text: 'Trend üçün ən azı 1 həftəlik çəki qeydi lazımdır. Hər səhər, tualetdən sonra, ac qarına çəkil.' };
    }
    if (st.rate > 0.5) {
      return { level: 'warn', text: `Çəki çox sürətlə artır (${F.signed(st.rate)} kq/həftə). Kalorini bir qədər azaltmaq lazım ola bilər.`, delta: -150 };
    }
    if (st.rate < -0.5) {
      return { level: 'warn', text: `Çəki çox sürətlə azalır (${F.signed(st.rate)} kq/həftə). Kalorini bir qədər artırmaq lazım ola bilər.`, delta: 150 };
    }
    if (st.waistCur && st.waistFirst && st.waistCur - st.waistFirst >= 2 && st.change > 0) {
      return {
        level: 'warn',
        text: `Bel ölçüsü ${F.signed(st.waistCur - st.waistFirst)} sm artıb — yağ yığımı ola bilər. Kalorini bir qədər azaltmaq lazım ola bilər.`,
        delta: -100,
      };
    }
    return { level: 'good', text: `Temp qaydasındadır (${F.signed(st.rate)} kq/həftə). İdeal: 0 … +0.4 kq/həftə və sabit bel ölçüsü.` };
  }

  save(date: string, kg: number, waist: number): boolean {
    if (!(kg > 30 && kg < 300)) {
      this.toast.show('Düzgün çəki daxil et');
      return false;
    }
    this.store.mutate((s) => {
      s.weights = s.weights.filter((w) => w.date !== date);
      s.weights.push({ date, kg: rnd(kg, 1), waist: waist > 40 && waist < 200 ? rnd(waist, 1) : null });
    });
    this.toast.show('Çəki qeyd edildi ✓');
    return true;
  }

  remove(date: string): void {
    this.store.mutate((s) => (s.weights = s.weights.filter((w) => w.date !== date)));
  }
}
