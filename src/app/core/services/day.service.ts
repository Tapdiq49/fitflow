import { Injectable, inject } from '@angular/core';
import { SLOTS } from '../data/meals';
import { TIPS } from '../data/program';
import { foodItem } from '../food-book';
import { Meal, Settings, TimelineItem, WeekDay, WeekPlan, newDay } from '../../common/interfaces';
import { mealMacros, menuTotals, sleepMinutes } from '../nutrition';
import { DateU, F, clamp, fromMin, hashStr, nowHM, toMin, uid } from '../utils';
import { KCAL_MAX, KCAL_MIN } from '../targets';
import { MenuService } from './menu.service';
import { ProgramService } from './program.service';
import { BUSY } from '../busy-keys';
import { DataSyncService } from './data-sync.service';
import { StoreService } from './store.service';
import { TrainerPlanService } from './trainer-plan.service';
import { ToastService } from './toast.service';
import { WorkoutService } from './workout.service';
import { t, td } from '../i18n/translate';

/** Daily water target in ml (trainer: minimum 1.5 L). */
const WATER_TARGET_ML = 1500;
/** Settings the auto-menu generator reads (see MenuService). */
const AUTO_MENU_SETTINGS = ['kcalTarget', 'proteinTarget', 'mealsPerDay', 'useWhey', 'workoutTime', 'wakeTime'] as const satisfies readonly (keyof Settings)[];
/** Largest single drink accepted from the manual field (guards against typos like 3500 → 35000). */
const MAX_DRINK_ML = 5000;

/** Day-level orchestration: plan creation, the "what to do today" timeline, score, water, meals. */
@Injectable({ providedIn: 'root' })
export class DayService {
  private readonly store = inject(StoreService);
  private readonly data = inject(DataSyncService);
  private readonly program = inject(ProgramService);
  private readonly menu = inject(MenuService);
  private readonly plans = inject(TrainerPlanService);
  private readonly workout = inject(WorkoutService);
  private readonly toast = inject(ToastService);

  ensureDay(k: string): void {
    // Past days keep the menu they had; only today and later follow a menu-mode change.
    const stays = (current: Meal[] | null | undefined): boolean => !!current && (k < DateU.today() || !this.menuModeMismatch(current));
    if (stays(this.store.peek(k)?.menu)) return;
    // Decided again when the change runs (an earlier call may have made the menu meanwhile); a failed save is reported by the data service.
    void this.data.commitDay(k, (d) => {
      if (stays(d.menu)) return false;
      d.menu = this.menu.generate(k, { keep: (d.menu ?? []).filter((m) => m.done || m.custom) });
      return true;
    });
  }

  /** Saves a week's trainer plan (null = drop it and fall back to the earlier week) and rebuilds stored menus from that week on. */
  setWeekPlan(week: string, plan: WeekPlan | null): void {
    if (plan) this.plans.save(week, plan);
    else this.plans.clear(week);
    this.rebuildTrainerMenus(week);
  }

  /** Rebuilds the stored menus from `from` (never before today: past days keep what they had) out of the trainer plans. Does nothing in auto mode. */
  rebuildTrainerMenus(from: string = DateU.today()): void {
    if (this.store.effectiveMenuMode() !== 'trainer') return;
    const start = from > DateU.today() ? from : DateU.today();
    void this.data.commit((s) => {
      let changed = false;
      for (const [k, d] of Object.entries(s.days)) {
        if (k < start || !d.menu) continue;
        d.menu = this.menu.generate(k, { keep: d.menu.filter((m) => m.done || m.custom) });
        changed = true;
      }
      return changed;
    });
  }

  /**
   * A stored menu built under the other menu mode (generated meals carry a templateId, trainer meals don't).
   * An empty menu counts too in auto mode: it is what a trainer plan without meals leaves behind, and the generator always has meals to give.
   */
  private menuModeMismatch(menu: Meal[]): boolean {
    const trainer = this.store.effectiveMenuMode() === 'trainer';
    if (!trainer && menu.length === 0) return true;
    return menu.some((m) => !m.custom && !m.done && (trainer ? !!m.templateId : !m.templateId));
  }

  waterTarget(_k?: string): number {
    return WATER_TARGET_ML;
  }

  timeline(k: string): TimelineItem[] {
    const d = this.store.peek(k) ?? newDay();
    const s = { ...this.store.settings(), ...d.snap };
    const type = this.program.dayType(k);
    // Meals depend on the person's height and weight: until they are entered no meal is suggested anywhere.
    const menu = this.store.bodyBasicsKnown() ? (d.menu ?? []) : [];
    const items: TimelineItem[] = menu.map((m) => {
      const mm = mealMacros(m);
      return {
        id: `meal:${m.id}`,
        time: m.time,
        label: SLOTS[m.slot] ? td(SLOTS[m.slot].label) : t('dash.meal'),
        sub: t('day.nNKcalN', { name: td(m.name), k: Math.round(mm.k), p: Math.round(mm.p) }),
        done: m.done,
      };
    });
    const breakfast = menu.find((m) => m.slot === 'breakfast')?.time ?? fromMin(toMin(s.wakeTime) + 30);
    if (s.showCreatine) items.push({ id: 'creatine', time: breakfast, label: t('day.creatine35G'), sub: t('day.withBreakfastWithWater'), done: d.creatine });
    if (type === 'training') {
      const count = this.workout.exercises(k).length;
      items.push({
        id: 'workout',
        time: s.workoutTime,
        label: this.workout.title(k),
        sub: this.workout.isTrainer() ? t('day.nExercises60Min', { n: count }) : t('day.nExercises60MinRir', { n: count, r: this.program.phase(k).rir }),
        done: !!(this.workout.get(k).savedAt || d.checks['workout']),
      });
    } else if (type === 'cardio') {
      items.push({
        id: 'cardio',
        time: s.workoutTime,
        label: t('common.cardio'),
        sub: d.cardio.type === 'jog' ? t('day.easyJog2025') : t('day.briskWalk2030'),
        done: d.cardio.done,
      });
    } else {
      items.push({ id: 'walk', time: '17:00', label: t('day.easyWalk'), sub: t('day.68ThousandSteps'), done: !!d.checks['walk'] });
      items.push({ id: 'mobility', time: '20:30', label: t('day.stretchingPerMobility'), sub: t('day.10MinutesHipsBack'), done: !!d.checks['mobility'] });
    }
    items.push({ id: 'sleep', time: s.sleepTime, label: t('common.sleep'), sub: t('day.target79Hours'), done: !!d.checks['sleep'] });
    items.sort((a, b) => a.time.localeCompare(b.time));
    const wt = this.waterTarget(k);
    items.push({
      id: 'water',
      time: '💧',
      label: t('day.waterNL', { v: F.liters(wt) }),
      sub: t('day.nLDrunk', { v: F.liters(d.water) }),
      done: d.water >= wt,
      auto: true,
      frac: Math.min(1, d.water / wt),
    });
    return items;
  }

  /** Completed timeline items (water counts partially) plus protein progress weighted ×2. */
  score(k: string): number | null {
    const d = this.store.peek(k);
    if (!d?.menu) return null;
    const items = this.timeline(k);
    const done = items.reduce((a, it) => a + (it.auto ? (it.frac ?? 0) : it.done ? 1 : 0), 0);
    const pFrac = Math.min(1, menuTotals(d.menu, true).p / this.store.settings().proteinTarget);
    return Math.round(((done + pFrac * 2) / (items.length + 2)) * 100);
  }

  toggle(k: string, id: string): Promise<boolean> {
    return this.data.commitDay(k, (d) => {
      if (id.startsWith('meal:')) {
        const m = d.menu?.find((x) => x.id === id.slice(5));
        if (m) m.done = !m.done;
      } else if (id === 'creatine') d.creatine = !d.creatine;
      else if (id === 'cardio') d.cardio.done = !d.cardio.done;
      else d.checks[id] = !d.checks[id];
    }, BUSY.toggle(k, id));
  }

  tip(k: string): string {
    const pool = [...TIPS[this.program.dayType(k)], ...TIPS.general];
    return td(pool[hashStr(k) % pool.length]);
  }

  weekData(k: string): WeekDay[] {
    const mon = DateU.monday(k);
    const today = DateU.today();
    return Array.from({ length: 7 }, (_, i) => {
      const dk = DateU.add(mon, i);
      const d = this.store.peek(dk);
      return {
        k: dk,
        type: this.program.dayType(dk),
        score: dk <= today ? this.score(dk) : null,
        p: d?.menu ? menuTotals(d.menu, true).p : null,
        water: d ? d.water : null,
        sleep: d ? sleepMinutes(d.sleep) : null,
        workout: !!(d && (d.workout?.savedAt || d.checks['workout'])),
        cardio: !!d?.cardio.done,
      };
    });
  }

  // ---------- meals ----------
  toggleMeal(k: string, id: string): Promise<boolean> {
    return this.toggle(k, `meal:${id}`);
  }

  async swapMeal(k: string, id: string): Promise<void> {
    let ok = false;
    const saved = await this.data.commitDay(k, (d) => {
      ok = !!d.menu && this.menu.swap(d.menu, id, k);
    }, BUSY.meal(k, id, 'swap'));
    if (saved) this.toast.show(ok ? t('day.alternativeMealSelected') : t('day.noAlternativeForThis'));
  }

  removeMeal(k: string, id: string): Promise<boolean> {
    return this.data.commitDay(k, (d) => {
      d.menu = (d.menu ?? []).filter((m) => m.id !== id);
    }, BUSY.meal(k, id, 'remove'));
  }

  /**
   * Whether saving settings should offer to rebuild the viewed day's menu: only for today or later, only in auto-menu mode
   * (the trainer's menu comes from the week plan and a mode switch is applied by ensureDay), and only when a setting the
   * generator reads changed.
   */
  offerMenuRegeneration(before: Settings, after: Settings, k: string): boolean {
    // The mode in force, not the chosen one: a person the app must not advise gets the trainer plan whatever the setting says.
    if (after.menuMode !== 'auto' || this.store.effectiveMenuMode() !== 'auto' || k < DateU.today()) return false;
    // Automatic targets follow the body data and rebuild the menus that no longer fit by themselves (TargetSyncService), so a change of them is not asked about.
    const autoTargets = after.targetMode === 'auto';
    return AUTO_MENU_SETTINGS.some((key) => !(autoTargets && (key === 'kcalTarget' || key === 'proteinTarget')) && before[key] !== after[key]);
  }

  /** New menu for the day; eaten and custom meals are kept. */
  async regenerateMenu(k: string): Promise<void> {
    let kept = 0;
    const saved = await this.data.commitDay(k, (d) => {
      const current = d.menu ?? [];
      const keep = current.filter((m) => m.done || m.custom);
      kept = keep.length;
      d.menu = this.menu.generate(k, { keep, avoid: current.map((m) => m.templateId ?? '') });
    }, BUSY.menu(k));
    if (saved) this.toast.show(kept ? t('day.newMenuCreatedEaten') : t('day.newMenuCreated'));
  }

  async resetDay(k: string): Promise<void> {
    // The old record is dropped and a fresh plan made in one change: the account never holds the day without its menu.
    const saved = await this.data.commit((s) => {
      const d = (s.days[k] = newDay());
      d.menu = this.menu.generate(k, { keep: [] });
    }, BUSY.menu(k));
    if (saved) this.toast.show(t('day.newDayPlanCreated'));
  }

  async addMeal(k: string, meal: Omit<Meal, 'id' | 'slot' | 'custom'>): Promise<boolean> {
    const saved = await this.data.commitDay(k, (d) => {
      const added: Meal = { ...meal, id: uid(), slot: 'custom', custom: true };
      d.menu = [...(d.menu ?? []), added].sort((a, b) => a.time.localeCompare(b.time));
    }, BUSY.menu(k));
    if (saved) this.toast.show(t('day.mealAdded'));
    return saved;
  }

  async addWhey(k: string): Promise<void> {
    const saved = await this.data.commitDay(k, (d) => {
      const menu = (d.menu ??= []);
      let m = menu.find((x) => x.slot === 'supp');
      if (!m) {
        m = { id: uid(), slot: 'supp', name: 'Whey protein shake', time: nowHM(), custom: true, done: true, items: [] };
        menu.push(m);
        menu.sort((a, b) => a.time.localeCompare(b.time));
      }
      const it = m.items.find((i) => i.food === 'whey');
      if (it) it.amt += 1;
      else m.items.push(foodItem('whey', 1));
    }, BUSY.menu(k));
    if (saved) this.toast.show(t('day.wheyAdded24G'));
  }

  // ---------- water / sleep / cardio ----------
  /** Adds a drink; also amounts typed by hand, rounded to whole ml. Returns false (nothing added) outside 1–5000 ml. */
  /** `source` names the button that asked (its busy key); the amount by default. */
  async addWater(k: string, ml: number, source: string | number = ml): Promise<boolean> {
    ml = Math.round(ml);
    if (!(ml >= 1 && ml <= MAX_DRINK_ML)) return false;
    const target = this.waterTarget(k);
    let before = 0;
    const saved = await this.data.commitDay(k, (d) => {
      before = d.water;
      d.water += ml;
      d.waterLog.push(ml);
    }, BUSY.water(k, source));
    if (saved && before < target && before + ml >= target) this.toast.show(t('day.waterTargetReached'));
    return saved;
  }

  undoWater(k: string): Promise<boolean> {
    return this.data.commitDay(k, (d) => {
      const ml = d.waterLog.pop();
      if (ml) d.water = Math.max(0, d.water - ml);
    }, BUSY.water(k, 'undo'));
  }

  setSleep(k: string, field: 'bed' | 'wake', value: string): Promise<boolean> {
    return this.data.commitDay(k, (d) => {
      d.sleep[field] = value;
      if (d.sleep.bed && d.sleep.wake) d.checks['sleep'] = true;
    }, BUSY.sleep(k, field));
  }

  setCardio(k: string, patch: Partial<{ type: 'walk' | 'jog'; minutes: string }>): Promise<boolean> {
    return this.data.commitDay(k, (d) => {
      Object.assign(d.cardio, patch);
    }, BUSY.cardio(k));
  }

  async toggleCardio(k: string): Promise<void> {
    let done = false;
    const saved = await this.data.commitDay(k, (d) => {
      d.cardio.done = !d.cardio.done;
      if (d.cardio.done && !d.cardio.minutes) d.cardio.minutes = d.cardio.type === 'jog' ? '20' : '25';
      done = d.cardio.done;
    }, BUSY.toggle(k, 'cardio'));
    if (saved && done) this.toast.show(t('day.cardioRecorded'));
  }

  /** Rebuilds the stored menus of today and later days whose totals are no longer close to the (changed) targets; eaten and custom meals stay. */
  refreshMenusForTargets(): void {
    if (this.store.effectiveMenuMode() !== 'auto') return;
    const { kcalTarget, proteinTarget } = this.store.settings();
    const today = DateU.today();
    void this.data.commit((s) => {
      let changed = false;
      for (const [k, d] of Object.entries(s.days)) {
        if (k < today || !d.menu?.length) continue;
        const totals = menuTotals(d.menu);
        if (Math.abs(totals.k - kcalTarget) <= 150 && Math.abs(totals.p - proteinTarget) <= 20) continue;
        d.menu = this.menu.generate(k, { keep: d.menu.filter((m) => m.done || m.custom) });
        changed = true;
      }
      return changed;
    });
  }

  /** The body-trend advice moves the calorie target. That is the user taking over the numbers, so automatic targets switch to typed ones. */
  adjustKcal(delta: number): void {
    let v = 0;
    this.store.mutate((s) => {
      s.settings.targetMode = 'custom';
      v = s.settings.kcalTarget = clamp(s.settings.kcalTarget + delta, KCAL_MIN, KCAL_MAX);
    });
    this.toast.show(t('day.calorieTargetNKcal', { v }));
  }
}
