import { newDay } from '../common/interfaces';
import { StoredUserData } from './repositories/user-data.repository';
import { applyUserDataChanges, diffUserData, isUserDataEmpty, replaceAllChanges } from './user-data';

const empty = (): StoredUserData => ({ days: {}, weights: [], history: {} });

describe('user data helpers', () => {
  it('finds nothing to send when two states hold the same data', () => {
    const a = empty();
    a.days['2026-10-05'] = newDay();
    a.weights.push({ date: '2026-10-05', kg: 80, waist: null });
    a.history['squat'] = [{ date: '2026-10-05', sets: [{ w: 60, r: 10 }] }];
    expect(diffUserData(a, structuredClone(a))).toBeNull();
  });

  it('reports a changed, an added and a deleted day', () => {
    const a = empty();
    a.days['2026-10-05'] = newDay();
    a.days['2026-10-06'] = newDay();
    const b = structuredClone(a);
    b.days['2026-10-05'].water = 250;
    b.days['2026-10-07'] = newDay();
    delete b.days['2026-10-06'];
    expect(diffUserData(a, b)).toEqual({ days: { '2026-10-05': b.days['2026-10-05'], '2026-10-07': newDay(), '2026-10-06': null } });
  });

  it('reports weights per day: new, changed and removed', () => {
    const a = empty();
    a.weights.push({ date: '2026-10-01', kg: 80, waist: null }, { date: '2026-10-02', kg: 81, waist: 90 });
    const b = empty();
    b.weights.push({ date: '2026-10-02', kg: 80.5, waist: 90 }, { date: '2026-10-03', kg: 79, waist: null });
    expect(diffUserData(a, b)).toEqual({ weights: { '2026-10-01': null, '2026-10-02': { kg: 80.5, waist: 90 }, '2026-10-03': { kg: 79, waist: null } } });
  });

  it('reports history per exercise and day, including a removed entry', () => {
    const a = empty();
    a.history['squat'] = [{ date: '2026-10-01', sets: [{ w: 60, r: 10 }] }];
    const b = empty();
    b.history['squat'] = [{ date: '2026-10-02', sets: [{ w: 62.5, r: 8 }] }];
    expect(diffUserData(a, b)?.history).toEqual([
      { exerciseId: 'squat', date: '2026-10-01', sets: null },
      { exerciseId: 'squat', date: '2026-10-02', sets: [{ w: 62.5, r: 8 }] },
    ]);
  });

  it('applying the difference of two states to the first gives the second', () => {
    const a = empty();
    a.days['2026-10-05'] = newDay();
    a.weights.push({ date: '2026-10-01', kg: 80, waist: null });
    a.history['squat'] = [{ date: '2026-10-01', sets: [{ w: 60, r: 10 }] }];
    const b = structuredClone(a);
    b.days['2026-10-05'].water = 500;
    b.weights = [{ date: '2026-10-02', kg: 79, waist: 88 }];
    b.history['squat'].push({ date: '2026-10-03', sets: [{ w: 65, r: 8 }] });
    b.history['row'] = [{ date: '2026-10-03', sets: [{ w: 40, r: 12 }] }];
    expect(applyUserDataChanges(a, diffUserData(a, b)!)).toEqual(b);
  });

  it('does not modify the data it applies a change to', () => {
    const a = empty();
    a.days['2026-10-05'] = newDay();
    const copy = structuredClone(a);
    applyUserDataChanges(a, { days: { '2026-10-05': null }, weights: { '2026-10-05': { kg: 80, waist: null } } });
    expect(a).toEqual(copy);
  });

  it('a replace-all change clears first and then holds everything', () => {
    const a = empty();
    a.days['2026-10-05'] = newDay();
    a.weights.push({ date: '2026-10-05', kg: 80, waist: null });
    const changes = replaceAllChanges(a);
    expect(changes.clear).toBe(true);
    const old = empty();
    old.days['2026-01-01'] = newDay();
    expect(applyUserDataChanges(old, changes)).toEqual(a);
  });

  it('tells an empty state from one that holds data', () => {
    expect(isUserDataEmpty(empty())).toBe(true);
    expect(isUserDataEmpty({ ...empty(), weights: [{ date: '2026-10-05', kg: 80, waist: null }] })).toBe(false);
    expect(isUserDataEmpty({ ...empty(), history: { squat: [] } })).toBe(true);
  });
});
