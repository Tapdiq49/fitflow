import { Injectable, computed, inject, signal } from '@angular/core';
import { FOODS, foodShort } from '../data/foods';
import { BloatStat } from '../models';
import { nowHM, uid } from '../utils';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';

/** Correlates logged bloating levels with foods. Observational only — not a diagnosis. */
@Injectable({ providedIn: 'root' })
export class BloatService {
  private readonly store = inject(StoreService);
  private readonly toast = inject(ToastService);

  /** Slider value shared between the dashboard card and the digestion page. */
  readonly level = signal(3);

  readonly stats = computed<BloatStat[]>(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const e of this.store.state().bloat) {
      for (const f of new Set(e.foods)) {
        const x = map.get(f) ?? { sum: 0, n: 0 };
        x.sum += e.level;
        x.n++;
        map.set(f, x);
      }
    }
    return [...map.entries()]
      .map(([key, x]) => ({ key, ...x, avg: x.sum / x.n, name: foodShort(key) }))
      .sort((a, b) => b.avg - a.avg || b.n - a.n);
  });

  /** Foods averaging ≥ 6/10 over at least two logs — avoided by the menu generator. */
  readonly triggers = computed(() => new Set(this.stats().filter((x) => x.n >= 2 && x.avg >= 6 && FOODS[x.key]).map((x) => x.key)));

  /** Foods of the eaten meals (or the whole plan if nothing is marked eaten yet). */
  dayFoods(k: string): string[] {
    const menu = this.store.peek(k)?.menu;
    if (!menu) return [];
    const done = menu.filter((m) => m.done);
    const src = done.length ? done : menu;
    return [...new Set(src.flatMap((m) => m.items.map((it) => it.food ?? `x:${String(it.name ?? '').toLowerCase()}`)))];
  }

  save(date: string, level: number, foods: Iterable<string>, note: string): void {
    this.store.mutate((s) => s.bloat.push({ id: uid(), date, time: nowHM(), level, foods: [...foods], note }));
    this.toast.show('Köp qeydi saxlanıldı ✓');
  }

  remove(id: string): void {
    this.store.mutate((s) => (s.bloat = s.bloat.filter((e) => e.id !== id)));
  }

  static levelClass(v: number): string {
    return v >= 6 ? 'bg-bad!' : v >= 4 ? 'bg-warn!' : 'bg-good!';
  }

  static levelText(v: number): string {
    return v <= 2 ? 'Yaxşı' : v <= 5 ? 'Orta' : v <= 7 ? 'Narahatedici' : 'Güclü';
  }
}
