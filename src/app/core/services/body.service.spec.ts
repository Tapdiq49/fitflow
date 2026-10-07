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

  it('records a weight for today and for earlier days', () => {
    expect(body.save(DateU.today(), 80, 0)).toBe(true);
    expect(body.save(DateU.add(DateU.today(), -3), 81, 0)).toBe(true);
    expect(store.state().weights).toHaveLength(2);
  });

  it('refuses tomorrow and every later day, whatever the weight', () => {
    expect(body.save(DateU.add(DateU.today(), 1), 80, 0)).toBe(false);
    expect(body.save(DateU.add(DateU.today(), 30), 80, 90)).toBe(false);
    expect(store.state().weights).toHaveLength(0);
  });

  it('uses the newest recorded weight as the current one, and the starting weight when there is none', () => {
    store.mutate((s) => (s.settings.startWeight = 100));
    expect(store.currentWeight()).toBe(100);
    body.save(DateU.add(DateU.today(), -5), 90, 0);
    body.save(DateU.add(DateU.today(), -1), 88, 0);
    expect(store.currentWeight()).toBe(88);
  });
});
