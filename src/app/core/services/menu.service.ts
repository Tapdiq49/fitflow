import { Injectable, inject } from '@angular/core';
import { FOODS } from '../data/foods';
import { SLOTS, TEMPLATES } from '../data/meals';
import { DayType, FoodRole, Meal, MealItem, MealTemplate, SlotId, TemplateKey } from '../models';
import { itemMacros, menuTotals } from '../nutrition';
import { DateU, clamp, fromMin, rnd, toMin, uid } from '../utils';
import { BloatService } from './bloat.service';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { TrainerPlanService } from './trainer-plan.service';

const SLOT_PLANS: Record<DayType | 'other', Record<4 | 5 | 6, SlotId[]>> = {
  training: {
    4: ['breakfast', 'lunch', 'pre', 'post'],
    5: ['breakfast', 'lunch', 'pre', 'post', 'dinner'],
    6: ['breakfast', 'snack', 'lunch', 'pre', 'post', 'dinner'],
  },
  cardio: { 4: [], 5: [], 6: [] },
  rest: { 4: [], 5: [], 6: [] },
  other: {
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
 * so oversized (bloating) portions never appear.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly store = inject(StoreService);
  private readonly program = inject(ProgramService);
  private readonly bloat = inject(BloatService);
  private readonly plans = inject(TrainerPlanService);

  slotsFor(type: DayType, n: number): SlotId[] {
    const c = clamp(Math.round(n) || 5, 4, 6) as 4 | 5 | 6;
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
    if (this.store.settings().menuMode === 'trainer') return this.trainerMenu(k, opts.keep ?? []);
    const type = this.program.dayType(k);
    const slots = this.slotsFor(type, this.store.settings().mealsPerDay);
    const keep = opts.keep ?? [];
    const prevMenu = this.store.peek(DateU.add(k, -1))?.menu ?? [];
    const avoid = new Set([...prevMenu.map((m) => m.templateId), ...(opts.avoid ?? [])]);
    const prevMains = new Set(prevMenu.filter((m) => ['lunch', 'post', 'dinner'].includes(m.slot)).map((m) => m.main));
    const triggers = this.bloat.triggers();
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
        const b = t.items.reduce((a, [f]) => a + (FOODS[f].bloat ?? 0), 0);
        w *= 1 / (1 + b * 0.5);
        if (t.items.some(([f]) => triggers.has(f))) w *= 0.25;
        return w;
      });
      used.add(tpl.id);
      if (tpl.main) usedMains.add(tpl.main);
      meals.push(this.buildMeal(slot, tpl, type, triggers));
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
    const nm = this.buildMeal(m.slot, tpl, this.program.dayType(k), this.bloat.triggers());
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
    const pool = (): MealItem[] =>
      meals.filter((m) => !m.locked && !m.custom).flatMap((m) => m.items.filter((it) => it.food && it.food !== 'whey'));

    const step = (roles: FoodRole[], dir: 1 | -1): boolean => {
      const c = pool().filter((it) => {
        const f = FOODS[it.food as string];
        if (!roles.includes(f.role)) return false;
        const n = it.amt + dir * f.step;
        return dir > 0 ? n <= f.max : n >= f.min;
      });
      if (!c.length) return false;
      c.sort((a, b) => a.amt / (a.base || a.amt) - b.amt / (b.base || b.amt));
      const it = dir > 0 ? c[0] : c[c.length - 1];
      it.amt = rnd(it.amt + dir * FOODS[it.food as string].step, 1);
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

    run();
    for (const [food, amt, slotRe] of EXTRAS) {
      if (menuTotals(meals).k >= tk - 100) break;
      const host = meals.find((m) => !m.locked && !m.custom && slotRe.test(m.slot) && !m.items.some((i) => i.food === food));
      if (host) {
        host.items.push({ food, amt, base: amt });
        run();
      }
    }
    if (menuTotals(meals).p < tp - 8 && s.useWhey && !meals.some((m) => m.items.some((i) => i.food === 'whey'))) {
      const host =
        meals.find((m) => m.slot === 'post' && !m.locked) ??
        meals.find((m) => m.slot.startsWith('snack') && !m.locked) ??
        meals.find((m) => !m.locked && !m.custom);
      if (host) {
        host.items.push({ food: 'whey', amt: 1, base: 1, note: 'protein çatışmazlığını tamamlamaq üçün' });
        run();
      }
    }
  }

  private pool(slot: SlotId, slots: SlotId[]): MealTemplate[] {
    const key = (SLOTS[slot].pool ?? slot) as TemplateKey;
    const pool = TEMPLATES[key] ?? [];
    return slot === 'dinner' && slots.includes('post') ? pool.filter((t) => t.light) : pool;
  }

  private buildMeal(slot: SlotId, tpl: MealTemplate, type: DayType, triggers: Set<string>): Meal {
    return {
      id: uid(),
      slot,
      name: tpl.name,
      templateId: tpl.id,
      main: tpl.main ?? null,
      time: this.slotTime(slot, type),
      done: false,
      items: tpl.items.map(([food, amt]) => this.substitute(food, amt, triggers)),
    };
  }

  /** Swaps a personal trigger food for its alternative with roughly equal calories. */
  private substitute(food: string, amt: number, triggers: Set<string>): MealItem {
    const f = FOODS[food];
    const alt = f.alt ? FOODS[f.alt] : undefined;
    if (f.alt && alt && triggers.has(food) && !triggers.has(f.alt)) {
      const kcal = itemMacros({ food, amt }).k;
      const per = alt.unit === 'q' ? alt.k / 100 : alt.k;
      const na = clamp(Math.round(kcal / per / alt.step) * alt.step, alt.min, alt.max);
      return { food: f.alt, amt: na, base: na, swapped: food };
    }
    return { food, amt, base: amt };
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
