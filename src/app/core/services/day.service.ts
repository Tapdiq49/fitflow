import { Injectable, inject } from '@angular/core';
import { SLOTS } from '../data/meals';
import { PROGRAM, TIPS } from '../data/program';
import { Meal, TimelineItem, WeekDay, newDay } from '../models';
import { mealMacros, menuTotals, sleepMinutes } from '../nutrition';
import { DateU, F, clamp, fromMin, hashStr, nowHM, toMin, uid } from '../utils';
import { BodyService } from './body.service';
import { MenuService } from './menu.service';
import { ProgramService } from './program.service';
import { StoreService } from './store.service';
import { ToastService } from './toast.service';
import { WorkoutService } from './workout.service';

/** Day-level orchestration: plan creation, the "what to do today" timeline, score, water, meals. */
@Injectable({ providedIn: 'root' })
export class DayService {
  private readonly store = inject(StoreService);
  private readonly program = inject(ProgramService);
  private readonly menu = inject(MenuService);
  private readonly workout = inject(WorkoutService);
  private readonly body = inject(BodyService);
  private readonly toast = inject(ToastService);

  ensureDay(k: string): void {
    if (this.store.peek(k)?.menu) return;
    const menu = this.menu.generate(k);
    this.store.mutateDay(k, (d) => (d.menu = menu));
  }

  /** ~35 ml/kg, +500 ml on gym days, +250 ml on cardio days. */
  waterTarget(k: string): number {
    let ml = Math.round((this.body.latestKg() * 35) / 250) * 250;
    const t = this.program.dayType(k);
    if (t === 'training') ml += 500;
    else if (t === 'cardio') ml += 250;
    return ml;
  }

  timeline(k: string): TimelineItem[] {
    const d = this.store.peek(k) ?? newDay();
    const s = this.store.settings();
    const type = this.program.dayType(k);
    const menu = d.menu ?? [];
    const items: TimelineItem[] = menu.map((m) => {
      const mm = mealMacros(m);
      return {
        id: `meal:${m.id}`,
        time: m.time,
        label: SLOTS[m.slot]?.label ?? 'Yemək',
        sub: `${m.name} · ${Math.round(mm.k)} kcal · ${Math.round(mm.p)} q protein`,
        done: m.done,
      };
    });
    const breakfast = menu.find((m) => m.slot === 'breakfast')?.time ?? fromMin(toMin(s.wakeTime) + 30);
    items.push({ id: 'creatine', time: breakfast, label: 'Kreatin 3–5 q', sub: 'Səhər yeməyi ilə, su ilə', done: d.creatine });
    if (type === 'training') {
      const v = this.program.variantOf(k);
      items.push({
        id: 'workout',
        time: s.workoutTime,
        label: `FULL BODY ${v}`,
        sub: `${PROGRAM[v].length} hərəkət · ~60 dəq · RIR ${this.program.phase(k).rir}`,
        done: !!(this.workout.get(k).savedAt || d.checks['workout']),
      });
    } else if (type === 'cardio') {
      items.push({
        id: 'cardio',
        time: s.workoutTime,
        label: 'Kardio',
        sub: d.cardio.type === 'jog' ? 'Yüngül qaçış 20–25 dəq' : 'Sürətli yerimə 20–30 dəq',
        done: d.cardio.done,
      });
    } else {
      items.push({ id: 'walk', time: '17:00', label: 'Yüngül gəzinti', sub: '6–8 min addım, rahat tempdə', done: !!d.checks['walk'] });
      items.push({ id: 'mobility', time: '20:30', label: 'Stretching / mobility', sub: '10 dəqiqə — omba, kürək, çiyin', done: !!d.checks['mobility'] });
    }
    items.push({ id: 'sleep', time: s.sleepTime, label: 'Yuxu', sub: 'Hədəf 7–9 saat · ekranı 30 dəq əvvəl söndür', done: !!d.checks['sleep'] });
    items.sort((a, b) => a.time.localeCompare(b.time));
    const wt = this.waterTarget(k);
    items.push({
      id: 'water',
      time: '💧',
      label: `Su: ${F.liters(wt)} L`,
      sub: `${F.liters(d.water)} L içilib`,
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

  toggle(k: string, id: string): void {
    this.store.mutateDay(k, (d) => {
      if (id.startsWith('meal:')) {
        const m = d.menu?.find((x) => x.id === id.slice(5));
        if (m) m.done = !m.done;
      } else if (id === 'creatine') d.creatine = !d.creatine;
      else if (id === 'cardio') d.cardio.done = !d.cardio.done;
      else d.checks[id] = !d.checks[id];
    });
  }

  tip(k: string): string {
    const pool = [...TIPS[this.program.dayType(k)], ...TIPS.general];
    return pool[hashStr(k) % pool.length];
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
  toggleMeal(k: string, id: string): void {
    this.toggle(k, `meal:${id}`);
  }

  swapMeal(k: string, id: string): void {
    let ok = false;
    this.store.mutateDay(k, (d) => (ok = !!d.menu && this.menu.swap(d.menu, id, k)));
    this.toast.show(ok ? 'Alternativ yemək seçildi' : 'Bu yemək üçün alternativ yoxdur');
  }

  removeMeal(k: string, id: string): void {
    this.store.mutateDay(k, (d) => (d.menu = (d.menu ?? []).filter((m) => m.id !== id)));
  }

  /** New menu for the day; eaten and custom meals are kept. */
  regenerateMenu(k: string): void {
    const current = this.store.peek(k)?.menu ?? [];
    const keep = current.filter((m) => m.done || m.custom);
    const menu = this.menu.generate(k, { keep, avoid: current.map((m) => m.templateId ?? '') });
    this.store.mutateDay(k, (d) => (d.menu = menu));
    this.toast.show(keep.length ? 'Yeni menyu yaradıldı (tamamlanmış yeməklər saxlanıldı)' : 'Yeni menyu yaradıldı ✓');
  }

  resetDay(k: string): void {
    this.store.mutate((s) => delete s.days[k]);
    this.ensureDay(k);
    this.toast.show('Yeni gün planı yaradıldı');
  }

  addMeal(k: string, meal: Omit<Meal, 'id' | 'slot' | 'custom'>): void {
    this.store.mutateDay(k, (d) => {
      const added: Meal = { ...meal, id: uid(), slot: 'custom', custom: true };
      d.menu = [...(d.menu ?? []), added].sort((a, b) => a.time.localeCompare(b.time));
    });
    this.toast.show('Yemək əlavə edildi ✓');
  }

  addWhey(k: string): void {
    this.store.mutateDay(k, (d) => {
      const menu = (d.menu ??= []);
      let m = menu.find((x) => x.slot === 'supp');
      if (!m) {
        m = { id: uid(), slot: 'supp', name: 'Whey protein shake', time: nowHM(), custom: true, done: true, items: [] };
        menu.push(m);
        menu.sort((a, b) => a.time.localeCompare(b.time));
      }
      const it = m.items.find((i) => i.food === 'whey');
      if (it) it.amt += 1;
      else m.items.push({ food: 'whey', amt: 1, base: 1 });
    });
    this.toast.show('Whey əlavə edildi: +24 q protein');
  }

  // ---------- water / sleep / cardio ----------
  addWater(k: string, ml: number): void {
    const target = this.waterTarget(k);
    const before = this.store.peek(k)?.water ?? 0;
    this.store.mutateDay(k, (d) => {
      d.water += ml;
      d.waterLog.push(ml);
    });
    if (before < target && before + ml >= target) this.toast.show('💧 Su hədəfi tamamlandı!');
  }

  undoWater(k: string): void {
    this.store.mutateDay(k, (d) => {
      const ml = d.waterLog.pop();
      if (ml) d.water = Math.max(0, d.water - ml);
    });
  }

  setSleep(k: string, field: 'bed' | 'wake', value: string): void {
    this.store.mutateDay(k, (d) => {
      d.sleep[field] = value;
      if (d.sleep.bed && d.sleep.wake) d.checks['sleep'] = true;
    });
  }

  setCardio(k: string, patch: Partial<{ type: 'walk' | 'jog'; minutes: string }>): void {
    this.store.mutateDay(k, (d) => Object.assign(d.cardio, patch));
  }

  toggleCardio(k: string): void {
    let done = false;
    this.store.mutateDay(k, (d) => {
      d.cardio.done = !d.cardio.done;
      if (d.cardio.done && !d.cardio.minutes) d.cardio.minutes = d.cardio.type === 'jog' ? '20' : '25';
      done = d.cardio.done;
    });
    if (done) this.toast.show('Kardio qeyd edildi ✓');
  }

  adjustKcal(delta: number): void {
    let v = 0;
    this.store.mutate((s) => (v = s.settings.kcalTarget = clamp(s.settings.kcalTarget + delta, 2000, 3400)));
    this.toast.show(`Kalori hədəfi: ${v} kcal. Yeni menyu yaradanda tətbiq olunacaq.`);
  }
}
