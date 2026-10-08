import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { Settings } from '../../common/interfaces';
import { DEFAULT_SETTINGS, StoreService } from './store.service';

/** Not part of the synced document: the body data has its own profile columns, the notice is about guests. */
const NOT_SYNCED: readonly string[] = ['height', 'startWeight', 'age', 'sex', 'guestNoticeDismissedAt'];
const KEYS = Object.keys({ ...DEFAULT_SETTINGS, programStart: '' }).filter((k) => !NOT_SYNCED.includes(k)) as (keyof Settings)[];

/** Key order does not matter (jsonb returns keys in its own order). */
const canon = (o: Record<string, unknown>): string => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

/** Every synced setting with its value, so the account holds the complete picture and a device never has to guess what a missing key means. */
export function settingsSnapshot(s: Settings): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of KEYS) out[k] = s[k];
  return out;
}

/**
 * Keeps the settings of a signed-in user in the account (`profiles.settings`), so a phone shows what the laptop was set to.
 * - Signing in: the account wins. Every synced setting becomes the account's value, or the default when the account holds none
 *   (settings of this browser are not copied into an account, the same rule as for the body data); the complete set is then
 *   written back, so an account that held nothing or an older partial document ends up with all of them.
 * - Afterwards every change is sent: all the synced settings, not only the changed ones.
 * Guests keep their settings in localStorage only. A failed upload is silent: the local value stays and the next change tries again.
 */
@Injectable({ providedIn: 'root' })
export class SettingsSyncService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);

  /** What the account holds (canonical JSON). Null = not read for this user yet, so nothing is sent. */
  private synced: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    const userId = computed(() => this.auth.user()?.id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => {
        this.synced = null;
        if (id) this.reconcile();
      });
    });
    effect(() => {
      const settings = this.store.settings();
      untracked(() => {
        if (this.synced !== null) this.queue = this.queue.then(() => this.push(settings));
      });
    });
  }

  private reconcile(): void {
    const user = this.auth.user();
    if (!user) return;
    const account = user.settings ?? {};
    this.synced = canon(account);
    const defaults = DEFAULT_SETTINGS as Record<string, unknown>;
    this.store.mutate((s) => {
      const target = s.settings as unknown as Record<string, unknown>;
      for (const k of KEYS) {
        if (k === 'programStart') {
          if (typeof account[k] === 'string' && account[k]) target[k] = account[k];
        } else {
          target[k] = k in account && typeof account[k] === typeof defaults[k] ? account[k] : defaults[k];
        }
      }
      s.settings = StoreService.normalize({ settings: s.settings }).settings;
    });
  }

  private async push(settings: Settings): Promise<void> {
    if (this.synced === null || !this.auth.user()) return;
    const snapshot = settingsSnapshot(settings);
    const json = canon(snapshot);
    if (json === this.synced) return;
    try {
      await this.auth.setSettings(snapshot);
      this.synced = json;
    } catch {
      // Stays local; the next change tries again.
    }
  }
}
