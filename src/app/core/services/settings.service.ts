import { Injectable, inject } from '@angular/core';
import { Settings } from '../../common/interfaces';
import { DateU } from '../utils';
import { DataSyncService } from './data-sync.service';
import { StoreService } from './store.service';

/** Settings that shape a day's timeline; see `DaySnapshot`. */
const TIMELINE_SETTINGS = ['workoutTime', 'wakeTime', 'sleepTime', 'showCreatine'] as const satisfies readonly (keyof Settings)[];

/** Saving the settings form. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly store = inject(StoreService);
  private readonly data = inject(DataSyncService);

  /**
   * Saves the settings form. When a setting that shapes the timeline changes, past days are frozen with the settings they were lived
   * under first (`DayRecord.snap`); those day records live in the account, so they are saved there before the new settings apply.
   * Resolves false (nothing saved, the user has been told why) when the account did not take that.
   */
  async save(form: Settings): Promise<boolean> {
    const before = this.store.settings();
    if (TIMELINE_SETTINGS.some((k) => before[k] !== form[k])) {
      const { workoutTime, wakeTime, sleepTime, showCreatine } = before;
      const today = DateU.today();
      const frozen = await this.data.commit((s) => {
        let changed = false;
        for (const [k, d] of Object.entries(s.days)) {
          if (k < today && !d.snap) {
            d.snap = { workoutTime, wakeTime, sleepTime, showCreatine };
            changed = true;
          }
        }
        return changed;
      });
      if (!frozen) return false;
    }
    this.store.updateSettings(form);
    return true;
  }
}
