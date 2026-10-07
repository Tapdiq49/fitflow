import { TestBed } from '@angular/core/testing';
import { DayService } from './day.service';
import { StoreService } from './store.service';

describe('DayService.addWater', () => {
  let store: StoreService;
  let day: DayService;
  const k = '2026-10-07';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    day = TestBed.inject(DayService);
  });

  it('adds a hand-typed amount and undoes it', () => {
    expect(day.addWater(k, 350)).toBe(true);
    expect(day.addWater(k, 250)).toBe(true);
    expect(store.peek(k)!.water).toBe(600);
    day.undoWater(k);
    expect(store.peek(k)!.water).toBe(350);
  });

  it('rounds to whole ml and rejects empty, zero, negative or huge amounts', () => {
    expect(day.addWater(k, 120.6)).toBe(true);
    for (const ml of [NaN, 0, -200, 5001]) expect(day.addWater(k, ml)).toBe(false);
    expect(store.peek(k)!.water).toBe(121);
    expect(store.peek(k)!.waterLog).toEqual([121]);
  });
});
