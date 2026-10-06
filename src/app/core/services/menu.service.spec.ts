import { TestBed } from '@angular/core/testing';
import { menuTotals } from '../nutrition';
import { DateU } from '../utils';
import { StoreService } from './store.service';
import { DayService } from './day.service';

describe('MenuService (via DayService.ensureDay)', () => {
  let store: StoreService;
  let day: DayService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    day = TestBed.inject(DayService);
  });

  it('keeps every generated day inside 2600–2800 kcal and 170–190 q protein', () => {
    const start = '2026-10-05';
    for (let i = 0; i < 120; i++) {
      const k = DateU.add(start, i);
      day.ensureDay(k);
      const t = menuTotals(store.peek(k)?.menu);
      expect(t.k).toBeGreaterThanOrEqual(2600);
      expect(t.k).toBeLessThanOrEqual(2800);
      expect(t.p).toBeGreaterThanOrEqual(170);
      expect(t.p).toBeLessThanOrEqual(190);
    }
  });

  it('does not repeat a meal template on consecutive days', () => {
    const start = '2026-10-05';
    for (let i = 0; i < 60; i++) day.ensureDay(DateU.add(start, i));
    for (let i = 1; i < 60; i++) {
      const prev = new Set(store.peek(DateU.add(start, i - 1))?.menu?.map((m) => m.templateId));
      const cur = store.peek(DateU.add(start, i))?.menu ?? [];
      expect(cur.some((m) => prev.has(m.templateId))).toBe(false);
    }
  });

  it('substitutes a logged bloat trigger with its alternative', () => {
    store.mutate((s) => {
      s.bloat.push({ id: 'a', date: '2026-10-01', time: '10:00', level: 8, foods: ['kefir'], note: '' });
      s.bloat.push({ id: 'b', date: '2026-10-02', time: '10:00', level: 7, foods: ['kefir'], note: '' });
    });
    for (let i = 0; i < 40; i++) day.ensureDay(DateU.add('2026-10-05', i));
    const foods = Object.values(store.state().days).flatMap((d) => d.menu ?? []).flatMap((m) => m.items.map((it) => it.food));
    expect(foods).not.toContain('kefir');
  });
});
