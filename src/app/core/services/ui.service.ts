import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DateU, fromMin } from '../utils';
import { DataSyncService } from './data-sync.service';
import { DayService } from './day.service';
import { StoreService } from './store.service';

/** Selected day, clock and dialog visibility. Creates the day's plan whenever a day is opened. */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly day = inject(DayService);
  private readonly data = inject(DataSyncService);
  private readonly store = inject(StoreService);

  readonly today = signal(DateU.today());
  readonly viewDate = signal(DateU.today());
  readonly now = signal(Date.now());
  readonly isToday = computed(() => this.viewDate() === this.today());
  /** "HH:MM" — changes once a minute, so dependents don't recompute every second. */
  readonly nowHM = computed(() => {
    const d = new Date(this.now());
    return fromMin(d.getHours() * 60 + d.getMinutes());
  });

  readonly addMealOpen = signal(false);
  readonly detailDate = signal<string | null>(null);

  constructor() {
    effect(() => {
      const k = this.viewDate();
      this.data.loads(); // the account's days replaced the local ones: the open day may need its plan again
      this.store.effectiveMenuMode(); // a switch between the trainer plan and the automatic menu rebuilds the open day at once
      untracked(() => this.day.ensureDay(k));
    });
    const timer = setInterval(() => this.tick(), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly sidebarCollapsed = computed(() => this.store.settings().sidebarCollapsed);

  toggleSidebar(): void {
    this.store.mutate((s) => (s.settings.sidebarCollapsed = !s.settings.sidebarCollapsed));
  }

  shift(n: number): void {
    this.viewDate.update((k) => DateU.add(k, n));
  }

  goToday(): void {
    this.viewDate.set(this.today());
  }

  /** Rolls over to the new day at midnight if the user was looking at "today". */
  private tick(): void {
    this.now.set(Date.now());
    const t = DateU.today();
    if (t !== this.today()) {
      if (this.viewDate() === this.today()) this.viewDate.set(t);
      this.today.set(t);
    }
  }
}
