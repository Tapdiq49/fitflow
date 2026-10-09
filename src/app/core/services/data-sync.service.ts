import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AppState, newDay } from '../../common/interfaces';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { AuthStore } from '../auth/auth.store';
import { assertOnline, saveErrorText } from '../auth/auth-errors';
import { UserDataRepository } from '../repositories/user-data.repository';
import { applyUserDataChanges, diffUserData, isUserDataEmpty, replaceAllChanges } from '../user-data';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';

/**
 * Keeps the daily records, the weights and the exercise history (`days`, `weights`, `exercise_history`) in the account of a signed-in user.
 * - Every change goes through `commit` / `commitDay`. For a signed-in user the change is sent to the account FIRST (one request, one
 *   transaction); only when the backend accepted it is it written to the state and localStorage. A failed request (offline, server
 *   error) changes nothing and tells the user why. For a guest the change is written to localStorage at once.
 * - Changes run one after another, so two quick taps (water, sets) can never overwrite each other.
 * - Signing in (and every app start with a session): the account's data replaces the browser's. When the account holds none yet, the
 *   browser's data is uploaded once instead (the first sign-in import), so nothing a guest recorded is lost.
 * Settings, plans and the body data have their own services; this one never touches them.
 */
@Injectable({ providedIn: 'root' })
export class DataSyncService {
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StoreService);
  /** Always provided by the app (`app.config.ts`); specs of services that only touch guest data leave it out. */
  private readonly repo = inject(UserDataRepository, { optional: true });
  private readonly toast = inject(ToastService);

  private queue: Promise<unknown> = Promise.resolve();
  private readonly _loads = signal(0);
  /** Counts the times the account's data replaced the local data; screens that build something from the data watch it. */
  readonly loads = this._loads.asReadonly();

  /** How many changes with a given busy key are waiting for the backend (queued or in flight). */
  private readonly pending = signal<ReadonlyMap<string, number>>(new Map());

  constructor() {
    const userId = computed(() => this.auth.user()?.id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => {
        if (id) void this.enqueue(() => this.load(id));
      });
    });
  }

  /**
   * Runs `fn` on a copy of the state; `fn` may change `days`, `weights` and `history` only (everything else is ignored for a
   * signed-in user). Return `false` from `fn` to change nothing. Resolves true when the change was stored, false (the user has been
   * told why) when it was not.
   */
  commit(fn: (s: AppState) => unknown, busyKey?: string): Promise<boolean> {
    if (!this.auth.user() && !this.auth.restoring()) return Promise.resolve(this.commitLocal(fn));
    return this.track(busyKey, this.enqueue(() => this.commitRemote(fn)));
  }

  /**
   * True while a change made with this `busyKey` is waiting for the backend: from the click until the answer (the time in the queue
   * counts), so the control that caused it can show a loader. Guests never wait, so it is always false for them. Keys: `core/busy-keys.ts`.
   */
  busy(busyKey: string): boolean {
    return (this.pending().get(busyKey) ?? 0) > 0;
  }

  /** `commit` for one day's record (created when missing). */
  commitDay(k: string, fn: (d: AppState['days'][string], s: AppState) => unknown, busyKey?: string): Promise<boolean> {
    return this.commit((s) => fn((s.days[k] ??= newDay()), s), busyKey);
  }

  /** Replaces all the data with an imported backup. Resolves false (nothing replaced) when the account did not take it. */
  async replaceAll(raw: unknown): Promise<boolean> {
    if (!raw || typeof raw !== 'object' || !('days' in raw)) throw new Error('Invalid backup');
    return this.enqueue(async () => {
      await this.auth.init();
      const incoming = StoreService.normalize(raw);
      if (this.auth.user()) {
        // The plans, settings and body data of an account are saved by their own services; a backup file does not overwrite them here.
        const current = this.store.state();
        incoming.weekPlans = current.weekPlans;
        incoming.workoutPlans = current.workoutPlans;
        Object.assign(incoming.settings, { height: current.settings.height, startWeight: current.settings.startWeight, age: current.settings.age, sex: current.settings.sex });
        if (!(await this.send(replaceAllChanges(incoming)))) return false;
      }
      this.store.replace(incoming);
      return true;
    });
  }

  /** Deletes all the data ("delete all data"). Resolves false (nothing deleted) when the account did not take it. */
  async clearAll(): Promise<boolean> {
    return this.enqueue(async () => {
      await this.auth.init();
      if (this.auth.user() && !(await this.send({ clear: true }))) return false;
      this.store.reset();
      return true;
    });
  }

  private track<T>(busyKey: string | undefined, work: Promise<T>): Promise<T> {
    if (!busyKey) return work;
    const bump = (by: number): void =>
      this.pending.update((m) => {
        const next = new Map(m);
        const n = (next.get(busyKey) ?? 0) + by;
        if (n > 0) next.set(busyKey, n);
        else next.delete(busyKey);
        return next;
      });
    bump(1);
    return work.finally(() => bump(-1));
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private commitLocal(fn: (s: AppState) => unknown): boolean {
    const next = structuredClone(this.store.state());
    if (fn(next) !== false) this.store.apply(next);
    return true;
  }

  private async commitRemote(fn: (s: AppState) => unknown): Promise<boolean> {
    await this.auth.init();
    if (!this.auth.user()) return this.commitLocal(fn);
    const base = this.store.state();
    const next = structuredClone(base);
    if (fn(next) === false) return true;
    const changes = diffUserData(base, next);
    if (!changes) return true;
    if (!(await this.send(changes))) return false;
    // Applied to the state as it is now (a setting may have changed while the request was out), not to the copy `fn` worked on.
    const current = this.store.state();
    this.store.apply({ ...current, ...applyUserDataChanges(current, changes) });
    return true;
  }

  /** One request to the account. False (the user has been told why) when it did not go through. */
  private async send(changes: Parameters<UserDataRepository['apply']>[0]): Promise<boolean> {
    try {
      assertOnline();
      if (!this.repo) throw new AuthError('not_configured');
      await this.repo.apply(changes);
      return true;
    } catch (e) {
      this.toast.show(saveErrorText(e));
      return false;
    }
  }

  private async load(id: string): Promise<void> {
    try {
      if (!this.repo) return;
      const remote = await this.repo.load();
      if (this.auth.user()?.id !== id) return; // signed out (or switched) while reading
      const local = this.store.state();
      if (isUserDataEmpty(remote)) {
        // The first sign-in: what this browser holds goes to the account once.
        if (!isUserDataEmpty(local)) await this.repo.apply(replaceAllChanges(local));
      } else {
        this.store.mutate((s) => {
          s.days = remote.days;
          s.weights = remote.weights;
          s.history = remote.history;
        });
      }
      this._loads.update((n) => n + 1);
    } catch {
      // Not loaded: the local data stays (what the account held at the last successful read), and the next change tells the user if the account cannot be reached.
    }
  }
}
