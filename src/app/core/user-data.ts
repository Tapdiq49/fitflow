import { HistorySet } from '../common/interfaces';
import { StoredUserData, UserDataChanges } from './repositories/user-data.repository';

/*
 * Pure helpers for the data that moves to the backend with every change (daily records, weights, exercise history):
 * what changed between two states, and the state that results from applying such a change.
 */

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const weightMap = (d: StoredUserData): Map<string, { kg: number; waist: number | null }> =>
  new Map(d.weights.map((w) => [w.date, { kg: w.kg, waist: w.waist ?? null }]));

const historyMap = (d: StoredUserData, id: string): Map<string, HistorySet[]> => new Map((d.history[id] ?? []).map((h) => [h.date, h.sets]));

/** What has to be sent to the backend to turn `base` into `next`; null when the two hold the same data. */
export function diffUserData(base: StoredUserData, next: StoredUserData): UserDataChanges | null {
  const changes: UserDataChanges = {};

  for (const k of new Set([...Object.keys(base.days), ...Object.keys(next.days)])) {
    const a = base.days[k];
    const b = next.days[k];
    if (!b) (changes.days ??= {})[k] = null;
    else if (!a || !same(a, b)) (changes.days ??= {})[k] = b;
  }

  const wa = weightMap(base);
  const wb = weightMap(next);
  for (const date of new Set([...wa.keys(), ...wb.keys()])) {
    const a = wa.get(date);
    const b = wb.get(date);
    if (!b) (changes.weights ??= {})[date] = null;
    else if (!a || a.kg !== b.kg || a.waist !== b.waist) (changes.weights ??= {})[date] = b;
  }

  for (const id of new Set([...Object.keys(base.history), ...Object.keys(next.history)])) {
    const ha = historyMap(base, id);
    const hb = historyMap(next, id);
    for (const date of new Set([...ha.keys(), ...hb.keys()])) {
      const a = ha.get(date);
      const b = hb.get(date);
      if (!b) (changes.history ??= []).push({ exerciseId: id, date, sets: null });
      else if (!a || !same(a, b)) (changes.history ??= []).push({ exerciseId: id, date, sets: b });
    }
  }

  return changes.days || changes.weights || changes.history ? changes : null;
}

/** The data after `changes` were applied to `data`. Does not modify `data`; unchanged entries are shared with it. */
export function applyUserDataChanges(data: StoredUserData, changes: UserDataChanges): StoredUserData {
  const days = changes.clear ? {} : { ...data.days };
  let weights = changes.clear ? [] : [...data.weights];
  const history = changes.clear ? {} : { ...data.history };

  for (const [k, record] of Object.entries(changes.days ?? {})) {
    if (record) days[k] = record;
    else delete days[k];
  }

  const touched = changes.weights ?? {};
  weights = weights.filter((w) => !(w.date in touched));
  for (const [date, w] of Object.entries(touched)) if (w) weights.push({ date, kg: w.kg, waist: w.waist });

  for (const c of changes.history ?? []) {
    const rest = (history[c.exerciseId] ?? []).filter((h) => h.date !== c.date);
    if (c.sets) rest.push({ date: c.date, sets: c.sets });
    rest.sort((x, y) => x.date.localeCompare(y.date));
    if (rest.length) history[c.exerciseId] = rest;
    else delete history[c.exerciseId];
  }

  return { days, weights, history };
}

/** True when there is nothing of the user's data at all. */
export function isUserDataEmpty(d: StoredUserData): boolean {
  return Object.keys(d.days).length === 0 && d.weights.length === 0 && Object.values(d.history).every((h) => h.length === 0);
}

/** The change that makes the backend hold exactly `data` (everything is replaced). */
export function replaceAllChanges(data: StoredUserData): UserDataChanges {
  return { clear: true, ...diffUserData({ days: {}, weights: [], history: {} }, data) };
}
