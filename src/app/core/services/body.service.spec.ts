import { TestBed } from '@angular/core/testing';
import { DateU } from '../utils';
import { BodyService } from './body.service';
import { StoreService } from './store.service';

describe('BodyService.save', () => {
  let body: BodyService;
  let store: StoreService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    body = TestBed.inject(BodyService);
    store = TestBed.inject(StoreService);
  });

  it('records a weight for today and for earlier days', async () => {
    expect(await body.save(DateU.today(), 80, 0)).toBe(true);
    expect(await body.save(DateU.add(DateU.today(), -3), 81, 0)).toBe(true);
    expect(store.state().weights).toHaveLength(2);
  });

  it('refuses tomorrow and every later day, whatever the weight', async () => {
    expect(await body.save(DateU.add(DateU.today(), 1), 80, 0)).toBe(false);
    expect(await body.save(DateU.add(DateU.today(), 30), 80, 90)).toBe(false);
    expect(store.state().weights).toHaveLength(0);
  });

  it('does not count a weight dated in the future (entered before that was refused) as the current one', () => {
    store.mutate((s) => (s.settings.startWeight = 90));
    store.mutate((s) => s.weights.push({ date: DateU.add(DateU.today(), 16), kg: 100, waist: null }));
    expect(store.currentWeight()).toBe(90);
    expect(body.latestKg()).toBe(90);
  });

  it('uses the newest recorded weight as the current one, and the starting weight when there is none', async () => {
    store.mutate((s) => (s.settings.startWeight = 100));
    expect(store.currentWeight()).toBe(100);
    await body.save(DateU.add(DateU.today(), -5), 90, 0);
    await body.save(DateU.add(DateU.today(), -1), 88, 0);
    expect(store.currentWeight()).toBe(88);
  });
});
