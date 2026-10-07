import { Injectable, inject } from '@angular/core';
import { SLOTS, TEMPLATES } from '../data/meals';
import { foodItem, foodOf } from '../food-book';
import { DayType, FoodRole, Meal, MealItem, MealTemplate, SlotId, TemplateKey } from '../models';
import { itemMacros, menuTotals } from '../nutrition';
import { DateU, clamp, fromMin, rnd, toMin, uid } from '../utils';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { TrainerPlanService } from './trainer-plan.service';

const SLOT_PLANS: Record<DayType | 'other', Record<3 | 4 | 5 | 6, SlotId[]>> = {
  training: {
    // Three meals: no separate pre- and post-workout meal; the evening meal is the one after training.
    3: ['breakfast', 'lunch', 'post'],
    4: ['breakfast', 'lunch', 'pre', 'post'],
    5: ['breakfast', 'lunch', 'pre', 'post', 'dinner'],
    6: ['breakfast', 'snack', 'lunch', 'pre', 'post', 'dinner'],
  },
  cardio: { 3: [], 4: [], 5: [], 6: [] },
  rest: { 3: [], 4: [], 5: [], 6: [] },
  other: {
    3: ['breakfast', 'lunch', 'dinner'],
    4: ['breakfast', 'lunch', 'snack2', 'dinner'],
    5: ['breakfast', 'snack', 'lunch', 'snack2', 'dinner'],
    6: ['breakfast', 'snack', 'lunch', 'snack2', 'dinner'],
  },
};

/** Fallback additions when portion caps stop calories from reaching the target. */
const EXTRAS: ReadonlyArray<readonly [string, number, RegExp]> = [
  ['banana', 1, /snack|pre|breakfast/],
  ['bread', 40, /lunch|dinner|post|snack/],
  ['almond', 10, /snack|breakfast/],
  ['rice', 100, /lunch|post|dinner/],
];

/**
 * Builds a varied daily menu from meal templates and scales portions step by step
 * until calories and protein land in the target range. Every food has a portion cap,
 * so oversized portions never appear.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly store = inject(StoreService);
  private readonly program = inject(ProgramService);
  private readonly plans = inject(TrainerPlanService);

  slotsFor(type: DayType, n: number): SlotId[] {
    const c = clamp(Math.round(n) || 5, 3, 6) as 3 | 4 | 5 | 6;
    return SLOT_PLANS[type === 'training' ? 'training' : 'other'][c];
  }

  slotTime(slot: SlotId, type: DayType): string {
    const s = this.store.settings();
    const w = toMin(s.workoutTime);
    const wake = toMin(s.wakeTime);
    const times: Partial<Record<SlotId, number>> = {
      breakfast: wake + 30,
      snack: wake + 210,
      lunch: 13 * 60 + 30,
      snack2: 16 * 60 + 30,
      pre: w - 60,
      post: w + 90,
      dinner: type === 'training' ? w + 210 : 19 * 60 + 30,
    };
    return fromMin(times[slot] ?? 12 * 60);
  }

  generate(k: string, opts: { keep?: Meal[]; avoid?: string[] } = {}): Meal[] {
    if (this.store.effectiveMenuMode() === 'trainer') return this.trainerMenu(k, opts.keep ?? []);
    const type = this.program.dayType(k);
    const slots = this.slotsFor(type, this.store.settings().mealsPerDay);
    const keep = opts.keep ?? [];
    const prevMenu = this.store.peek(DateU.add(k, -1))?.menu ?? [];
    const avoid = new Set([...prevMenu.map((m) => m.templateId), ...(opts.avoid ?? [])]);
    const prevMains = new Set(prevMenu.filter((m) => ['lunch', 'post', 'dinner'].includes(m.slot)).map((m) => m.main));
    const used = new Set(keep.map((m) => m.templateId));
    const usedMains = new Set(keep.map((m) => m.main).filter(Boolean));
    const meals: Meal[] = keep.map((m) => ({ ...m, locked: true }));

    for (const slot of slots) {
      if (keep.some((m) => m.slot === slot)) continue;
      const pool = this.pool(slot, slots);
      let cands = pool.filter((t) => !used.has(t.id) && !avoid.has(t.id));
      if (!cands.length) cands = pool.filter((t) => !used.has(t.id));
      if (!cands.length) cands = pool;
      const tpl = this.pick(cands, (t) => {
        let w = 1;
        if (t.main && (usedMains.has(t.main) || prevMains.has(t.main))) w *= 0.12;
        return w;
      });
      used.add(tpl.id);
      if (tpl.main) usedMains.add(tpl.main);
      meals.push(this.buildMeal(slot, tpl, type));
    }
    meals.sort((a, b) => a.time.localeCompare(b.time));
    this.balance(meals);
    meals.forEach((m) => delete m.locked);
    return meals;
  }

  /** Trainer's plan for the day's week; kept (eaten/custom) meals replace the planned ones in their slot. */
  private trainerMenu(k: string, keep: Meal[]): Meal[] {
    const planned = structuredClone(this.plans.planFor(DateU.monday(k))[DateU.dow(k)] ?? [])
      .filter((t) => !keep.some((m) => m.slot === t.slot))
      .map((t): Meal => ({ id: uid(), slot: t.slot, name: t.name, main: null, time: t.time, done: false, items: t.items }));
    return [...keep, ...planned].sort((a, b) => a.time.localeCompare(b.time));
  }

  /** Replaces one meal (in place) with another template for the same slot. */
  swap(menu: Meal[], mealId: string, k: string): boolean {
    const m = menu.find((x) => x.id === mealId);
    if (!m || m.custom || !m.templateId) return false;
    const pool = this.pool(m.slot, menu.map((x) => x.slot));
    const others = new Set(menu.filter((x) => x !== m).map((x) => x.templateId));
    const otherMains = new Set(menu.filter((x) => x !== m).map((x) => x.main).filter(Boolean));
    let cands = pool.filter((t) => t.id !== m.templateId && !others.has(t.id));
    if (!cands.length) cands = pool.filter((t) => t.id !== m.templateId);
    if (!cands.length) return false;
    const tpl = this.pick(cands, (t) => (t.main && otherMains.has(t.main) ? 0.2 : 1));
    const nm = this.buildMeal(m.slot, tpl, this.program.dayType(k));
    nm.time = m.time;
    menu.forEach((x) => (x.locked = x !== m));
    menu[menu.indexOf(m)] = nm;
    this.balance(menu);
    menu.forEach((x) => delete x.locked);
    return true;
  }

  /** Scales unlocked portions until protein ≈ target ±6 q and calories ≈ target ±40 kcal. */
  balance(meals: Meal[]): void {
    const s = this.store.settings();
    const tk = s.kcalTarget;
    const tp = s.proteinTarget;
    // Portion caps are set for about 2700 kcal. A much smaller target needs smaller portions, a much bigger one bigger portions.
    const smaller = clamp(tk / 2400, 0.5, 1);
    const bigger = clamp(tk / 2700, 1, 1.6);
    const pool = (): MealItem[] =>
      meals.filter((m) => !m.locked && !m.custom).flatMap((m) => m.items.filter((it) => it.food && it.food !== 'whey'));

    const step = (roles: FoodRole[], dir: 1 | -1): boolean => {
      const c = pool().filter((it) => {
        const f = foodOf(it.food as string);
        if (!f || !roles.includes(f.role)) return false;
        const n = it.amt + dir * f.step;
        return dir > 0 ? n <= f.max * bigger : n >= Math.max(f.step, f.min * smaller);
      });
      if (!c.length) return false;
      c.sort((a, b) => a.amt / (a.base || a.amt) - b.amt / (b.base || b.amt));
      const it = dir > 0 ? c[0] : c[c.length - 1];
      it.amt = rnd(it.amt + dir * (foodOf(it.food as string)?.step ?? 0), 1);
      return true;
    };

    const run = (): void => {
      for (let i = 0; i < 150; i++) {
        let changed = false;
        let t = menuTotals(meals);
        if (t.p < tp - 6) changed = step(['protein'], 1) || changed;
        else if (t.p > tp + 6) changed = step(['protein'], -1) || changed;
        t = menuTotals(meals);
        if (t.k < tk - 40) changed = step(['carb'], 1) || step(['fruit', 'dairy'], 1) || step(['fat'], 1) || changed;
        else if (t.k > tk + 40) changed = step(['fat'], -1) || step(['carb'], -1) || changed;
        if (!changed) break;
      }
    };

    // A small protein target can be out of reach even with the smallest portions: drop protein items, side meals first, and refill with carbs.
    const DROP_ORDER: SlotId[] = ['snack', 'snack2', 'breakfast', 'pre', 'dinner', 'lunch', 'post'];
    const dropProtein = (): boolean => {
      const cands = meals
        .filter((m) => !m.locked && !m.custom && m.items.length > 2)
        .flatMap((m) => m.items.filter((it) => it.food && foodOf(it.food)?.role === 'protein').map((it) => ({ m, it })))
        .sort((a, b) => DROP_ORDER.indexOf(a.m.slot) - DROP_ORDER.indexOf(b.m.slot) || itemMacros(b.it).p - itemMacros(a.it).p);
      if (!cands.length) return false;
      cands[0].m.items = cands[0].m.items.filter((x) => x !== cands[0].it);
      return true;
    };

    run();
    for (let i = 0; i < 8 && menuTotals(meals).p > tp + 10 && dropProtein(); i++) run();
    for (const [food, amt, slotRe] of EXTRAS) {
      if (menuTotals(meals).k >= tk - 100) break;
      const host = meals.find((m) => !m.locked && !m.custom && slotRe.test(m.slot) && !m.items.some((i) => i.food === food));
      if (host) {
        host.items.push(foodItem(food, amt));
        run();
      }
    }
    if (menuTotals(meals).p < tp - 8 && s.useWhey && !meals.some((m) => m.items.some((i) => i.food === 'whey'))) {
      const host =
        meals.find((m) => m.slot === 'post' && !m.locked) ??
        meals.find((m) => m.slot.startsWith('snack') && !m.locked) ??
        meals.find((m) => !m.locked && !m.custom);
      if (host) {
        host.items.push({ ...foodItem('whey', 1), note: 'protein çatışmazlığını tamamlamaq üçün' });
        run();
      }
    }
  }

  private pool(slot: SlotId, slots: SlotId[]): MealTemplate[] {
    const key = (SLOTS[slot].pool ?? slot) as TemplateKey;
    const pool = TEMPLATES[key] ?? [];
    return slot === 'dinner' && slots.includes('post') ? pool.filter((t) => t.light) : pool;
  }

  private buildMeal(slot: SlotId, tpl: MealTemplate, type: DayType): Meal {
    return {
      id: uid(),
      slot,
      name: tpl.name,
      templateId: tpl.id,
      main: tpl.main ?? null,
      time: this.slotTime(slot, type),
      done: false,
      items: tpl.items.map(([food, amt]) => foodItem(food, amt)),
    };
  }

  private pick<T>(pool: T[], weight: (t: T) => number): T {
    const ws = pool.map(weight);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= ws[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
}
