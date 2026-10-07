import { Injectable, effect, inject, untracked } from '@angular/core';
import { plausibleBody, suggestTargets } from '../targets';
import { BodyService } from './body.service';
import { DayService } from './day.service';
import { StoreService } from './store.service';

/**
 * Automatic targets: while `targetMode` is `auto` and the body data is complete and safe to advise on, the calorie and protein
 * targets in the settings follow `suggestTargets` (body data, newest weight and goal). Everything else keeps reading
 * `settings().kcalTarget / proteinTarget`. When the numbers change, stored menus that no longer fit them are rebuilt.
 * Created at app start.
 */
@Injectable({ providedIn: 'root' })
export class TargetSyncService {
  private readonly store = inject(StoreService);
  private readonly body = inject(BodyService);
  private readonly day = inject(DayService);

  constructor() {
    effect(() => {
      const s = this.store.settings();
      const weight = this.body.latestKg();
      if (s.targetMode !== 'auto' || this.store.bodySafetyIssue() || !this.store.bodyBasicsKnown() || weight == null || !plausibleBody(s.height as number, weight)) return;
      const target = suggestTargets({ height: s.height as number, weight, age: s.age as number, sex: s.sex as 'male' | 'female', goal: s.goal });
      untracked(() => {
        if (s.kcalTarget === target.kcal && s.proteinTarget === target.protein) return;
        this.store.mutate((d) => {
          d.settings.kcalTarget = target.kcal;
          d.settings.proteinTarget = target.protein;
        });
        this.day.refreshMenusForTargets();
      });
    });
  }
}
