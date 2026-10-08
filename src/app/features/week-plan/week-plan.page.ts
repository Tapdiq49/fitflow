import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { SLOTS } from '../../core/data/meals';
import { TRAINER_PLAN, TRAINER_SLOTS, trainerExId } from '../../core/data/trainer-plan';
import { MealItem, SlotId, TrainerMeal, WeekPlan, WorkoutWeekPlan } from '../../common/interfaces';
import { PlanKind } from '../../core/repositories/plan.repository';
import { PlanSyncService } from '../../core/services/plan-sync.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { TrainerPlanService } from '../../core/services/trainer-plan.service';
import { DateU, clamp, dayName, fromMin, inputValue, parseNum, toMin } from '../../core/utils';
import { RouterLink } from '@angular/router';
import { Listbox, Option } from '@angular/aria/listbox';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { IconComponent } from '../../shared/icon/icon.component';
import { BodyBasicsFormComponent } from '../profile/body-basics-form.component';
import { TimePickerComponent } from '../../shared/forms/time-picker.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { TimePipe } from '../../common/pipes/format/time.pipe';
import { t, td } from '../../core/i18n/translate';

interface ExRow {
  name: string;
  sets: string;
  min: string;
  max: string;
}

interface Row {
  slot: SlotId;
  time: string;
  text: string;
  /** Meal as it was when the editor opened — kept when the text is untouched, so its macros survive. */
  name0: string;
  items0: MealItem[];
}

@Component({
  selector: 'app-week-plan-page',
  imports: [RouterLink, BodyBasicsFormComponent, Tabs, TabList, Tab, TabPanel, TabContent, Listbox, Option, IconComponent, TimePickerComponent, TPipe, TimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div ngTabs class="flex flex-col gap-[18px]">
      @if (store.bodySafetyIssue(); as issue) {
        <div class="alert alert-bad" role="alert"><app-icon name="alert" /><div><b>{{ 'safety.title' | t }}</b> {{ (issue === 'minor' ? 'safety.minor' : 'safety.underweight') | t }} {{ 'safety.basis' | t: { bmi: store.currentBmi(), kg: store.currentWeight() } }} {{ 'safety.ownPlanHere' | t }}</div></div>
      }
      @if (!store.bodyBasicsKnown()) {
        <div class="alert alert-info"><app-icon name="info" /><div class="w-full"><p style="margin: 0 0 10px"><b>{{ 'bodyBasics.title' | t }}</b> {{ 'bodyBasics.why' | t }}</p><app-body-basics-form /></div></div>
      }
      <div ngTabList [(selectedTab)]="tab" class="flex gap-2">
        <button ngTab value="meal" class="btn" [class.btn-primary]="tab() === 'meal'"><app-icon name="utensils" size="sm" />{{ 'plan.mealPlan' | t }}</button>
        <button ngTab value="workout" class="btn" [class.btn-primary]="tab() === 'workout'"><app-icon name="dumbbell" size="sm" />{{ 'plan.workoutPlan' | t }}</button>
      </div>
      <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 rounded-[calc(var(--r)_*_12px)] border border-border-soft bg-surface p-1">
            <button class="btn btn-ghost btn-icon" (click)="shift(-1)" [attr.aria-label]="'plan.previousWeek' | t"><app-icon name="left" /></button>
            <span class="px-2.5 font-semibold whitespace-nowrap">{{ label() }}</span>
            <button class="btn btn-ghost btn-icon" (click)="shift(1)" [attr.aria-label]="'plan.nextWeek' | t"><app-icon name="right" /></button>
          </div>
          <span class="badge" [class.badge-training]="planState() === 'own'">{{ planStateLabel() }}</span>
        </div>
        @if (tab() === 'meal') {
        <p class="text-muted" style="font-size: 0.75rem; margin: 10px 0 0">
          {{ 'plan.leaveMealFieldEmpty' | t }}
        </p>
        @if (store.effectiveMenuMode() === 'auto') {
          <div class="alert alert-info mt-3" role="status">
            <app-icon name="info" />
            <div>{{ 'plan.autoMenuInUse' | t }} <a routerLink="/settings">{{ 'nav.settings' | t }}</a></div>
          </div>
        }
        @if (weekEmpty() && !store.bodySafetyIssue()) {
          <button class="btn btn-sm" style="margin-top: 10px" (click)="addSuggestionAll()"><app-icon name="plus" size="sm" />{{ 'plan.addSuggestionAll' | t }}</button>
        }
        } @else {
          <p class="text-muted" style="font-size: 0.75rem; margin: 10px 0 0">
            {{ 'plan.enterExercisesTrainerGave' | t }}
          </p>
          @if (store.effectiveWorkoutMode() !== 'trainer') {
            <p class="mt-2 mb-0 text-[0.75rem] text-warn">{{ 'plan.workoutModeCurrentlyBuilt' | t }}</p>
          }
        }
      </div>

      <div ngTabPanel value="meal" class="flex flex-col gap-[18px] inert:hidden">
      <ng-template ngTabContent>
      @for (day of days; track day) {
        <div class="card">
          <div class="card-head"><h3>{{ dayLabel(day) }}</h3></div>
          <div class="flex flex-wrap items-start gap-4">
          <div class="min-w-[18.75rem] flex-1">
          @for (r of draft()[day]; track r.slot; let i = $index) {
            <div class="mb-2 grid grid-cols-[110px_112px_1fr_36px] items-center gap-2 phone:grid-cols-[90px_1fr_36px]">
              <span class="text-[0.8125rem] text-text-2">{{ slotLabel(r.slot) }}</span>
              <app-time-picker [label]="'common.time' | t" [value]="r.time" (valueChange)="setTime(day, i, $event)" />
              <input type="text" [value]="r.text" (input)="setText(day, i, $event)" [placeholder]="'plan.eGBuckwheat4' | t" class="phone:col-span-3" />
              <button class="btn btn-ghost btn-icon btn-sm" (click)="removeMeal(day, r.slot)" [attr.aria-label]="('common.delete' | t) + ': ' + slotLabel(r.slot)"><app-icon name="x" size="sm" /></button>
            </div>
          }
          @if (unusedSlots(day); as free) {
            @if (free.length) {
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <span class="text-[0.75rem] text-muted">{{ 'plan.addMeal' | t }}:</span>
                @for (slot of free; track slot) {
                  <button class="btn btn-ghost btn-sm" (click)="addMeal(day, slot)"><app-icon name="plus" size="sm" />{{ slotLabel(slot) }}</button>
                }
              </div>
            }
          }
          </div>
          @if (suggestionFor(day); as suggested) {
            <aside class="w-[18.75rem] rounded-[calc(var(--r)_*_12px)] border border-dashed border-border bg-surface-2 p-3 phone:w-full">
              <b class="text-[0.8125rem]">{{ 'plan.suggestion' | t }}</b>
              <p class="text-muted" style="font-size: 0.75rem; margin: 2px 0 8px">{{ 'plan.suggestionHint' | t }}</p>
              @for (m of suggested; track m.slot) {
                <div class="text-[0.75rem] text-text-2"><b class="tabular-nums">{{ m.time | time }}</b> {{ slotLabel(m.slot) }}: {{ m.name }}</div>
              }
              <button class="btn btn-sm" style="margin-top: 10px" (click)="addSuggestion(day)"><app-icon name="plus" size="sm" />{{ 'plan.addSuggestion' | t }}</button>
            </aside>
          }
          </div>
        </div>
      }

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" [disabled]="saving()" (click)="save()"><app-icon name="save" size="sm" />{{ 'plan.savePlan' | t }}</button>
        @if (own()) {
          <button class="btn btn-danger" [disabled]="saving()" (click)="clear()"><app-icon name="trash" size="sm" />{{ 'plan.revertToPreviousWeeksPlan' | t }}</button>
        }
      </div>
      </ng-template>
      </div>

      <div ngTabPanel value="workout" class="flex flex-col gap-[18px] inert:hidden">
      <ng-template ngTabContent>
        <div class="card">
          <div class="card-head"><h3 id="gym-days-title"><app-icon name="calendar" /> {{ 'plan.gymDays' | t }}</h3></div>
          <div
            ngListbox
            [multi]="true"
            orientation="horizontal"
            focusMode="roving"
            selectionMode="explicit"
            [value]="wDays()"
            (valueChange)="setGymDays($event)"
            aria-labelledby="gym-days-title"
            class="flex flex-wrap gap-2"
          >
            @for (d of days; track d) {
              <div ngOption [value]="d" [label]="dayName(d - 1)" class="btn btn-sm" [class.btn-primary]="wDays().includes(d)">{{ dayName(d - 1) }}</div>
            }
          </div>
          <p class="text-muted" style="font-size: 0.75rem; margin: 10px 0 0">{{ 'plan.gymDaysHint' | t }}</p>
        </div>
        @for (day of wDays(); track day) {
          <div class="card">
            <div class="card-head"><h3>{{ dayLabel(day) }}</h3></div>
            @for (r of wDraft()[day]; track $index; let i = $index) {
              <div class="mb-2 grid grid-cols-[1fr_64px_64px_64px_36px] items-center gap-2 phone:grid-cols-[1fr_56px_56px_56px_36px]">
                <input type="text" [value]="r.name" (input)="setEx(day, i, 'name', $event)" [placeholder]="'plan.exerciseNameEG' | t" [attr.aria-label]="'common.exercise' | t" />
                <input type="text" inputmode="numeric" class="text-center" [value]="r.sets" (input)="setEx(day, i, 'sets', $event)" [placeholder]="'plan.sets' | t" [attr.aria-label]="'plan.numberOfSets' | t" />
                <input type="text" inputmode="numeric" class="text-center" [value]="r.min" (input)="setEx(day, i, 'min', $event)" [placeholder]="'plan.min' | t" [attr.aria-label]="'plan.minReps' | t" />
                <input type="text" inputmode="numeric" class="text-center" [value]="r.max" (input)="setEx(day, i, 'max', $event)" [placeholder]="'plan.max' | t" [attr.aria-label]="'plan.maxReps' | t" />
                <button class="btn btn-ghost btn-icon btn-sm" (click)="removeEx(day, i)" [attr.aria-label]="'plan.deleteExercise' | t"><app-icon name="x" size="sm" /></button>
              </div>
            }
            <button class="btn btn-ghost btn-sm" (click)="addEx(day)"><app-icon name="plus" size="sm" />{{ 'plan.addExercise' | t }}</button>
          </div>
        }
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn btn-primary" [disabled]="saving()" (click)="saveWorkout()"><app-icon name="save" size="sm" />{{ 'plan.saveWorkoutPlan' | t }}</button>
          @if (wOwn()) {
            <button class="btn btn-danger" [disabled]="saving()" (click)="clearWorkout()"><app-icon name="trash" size="sm" />{{ 'plan.revertToPreviousWeeks' | t }}</button>
          }
        </div>
      </ng-template>
      </div>
    </div>
  `,
})
export class WeekPlanPage {
  private readonly plans = inject(TrainerPlanService);
  private readonly planSync = inject(PlanSyncService);
  /** A save or clear is on its way to the account; the buttons wait for it. */
  protected readonly saving = signal(false);
  private readonly day = inject(DayService);
  private readonly toast = inject(ToastService);

  protected readonly store = inject(StoreService);
  /** Selected tab: 'meal' or 'workout' (string because `ngTabList` selects by value). */
  protected readonly tab = signal<string | undefined>('meal');
  protected readonly days = [1, 2, 3, 4, 5, 6, 7];
  protected readonly dayName = dayName;
  protected readonly week = signal(DateU.monday(DateU.today()));
  protected readonly own = computed(() => this.plans.hasOwn(this.week()));
  protected readonly label = computed(() => `${DateU.short(this.week())} – ${DateU.short(DateU.add(this.week(), 6))}`);

  protected readonly wOwn = computed(() => this.plans.hasOwnWorkout(this.week()));
  /** What the selected tab holds for this week: its own plan, an earlier week's plan carried over, or nothing entered at all. */
  protected readonly planState = computed<'own' | 'previous' | 'empty'>(() => {
    const meal = this.tab() === 'meal';
    const week = this.week();
    const filled = meal ? Object.values(this.plans.planFor(week)).some((day) => day.length > 0) : Object.values(this.plans.workoutFor(week)).some((day) => day.length > 0);
    if (!filled) return 'empty';
    return (meal ? this.own() : this.wOwn()) ? 'own' : 'previous';
  });
  protected readonly planStateLabel = computed(() => t(({ own: 'plan.planWrittenForThis', previous: 'plan.previousWeeksPlanIn', empty: 'plan.noPlanEntered' } as const)[this.planState()]));
  /** Editable copy of the trainer workout in effect for the selected week. */
  protected readonly wDraft = linkedSignal<Record<number, ExRow[]>>(() => this.toExRows(this.plans.workoutFor(this.week())));
  /** Gym weekdays chosen for the selected week — the only days the trainer workout is entered for. */
  protected readonly wDays = linkedSignal<number[]>(() => this.plans.gymDays(this.week()));

  /** Editable copy of the plan in effect for the selected week; re-synced when the week or stored plans change. */
  protected readonly draft = linkedSignal<Record<number, Row[]>>(() => this.toRows(this.plans.planFor(this.week())));

  protected dayLabel(d: number): string {
    return `${t('plan.dayN', { d })} · ${dayName(d - 1)} · ${DateU.short(DateU.add(this.week(), d - 1))}`;
  }

  protected slotLabel(s: SlotId): string {
    return td(SLOTS[s].label);
  }

  protected shift(n: number): void {
    this.week.update((w) => DateU.add(w, n * 7));
  }

  /** Meals a day of the trainer plan can have, in the order they are eaten; each at most once a day. */
  private static readonly SLOT_ORDER: readonly SlotId[] = ['breakfast', 'snack', 'lunch', 'snack2', 'pre', 'post', 'dinner'];

  /** The built-in trainer plan for a day, offered while that day has no meals yet. */
  protected suggestionFor(day: number): TrainerMeal[] | null {
    const suggested = TRAINER_PLAN[day];
    // The built-in plan (a trainer's menu of about 2700 kcal) is not offered to a person the app must not advise.
    return !this.draft()[day].length && suggested?.length && !this.store.bodySafetyIssue() ? suggested : null;
  }

  protected readonly weekEmpty = computed(() => this.days.every((d) => !this.draft()[d].length));

  protected addSuggestion(day: number): void {
    const rows = (TRAINER_PLAN[day] ?? []).map((m): Row => ({ slot: m.slot, time: m.time, text: m.name, name0: m.name, items0: structuredClone(m.items) }));
    this.draft.update((d) => ({ ...d, [day]: rows.sort((a, b) => a.time.localeCompare(b.time)) }));
  }

  protected addSuggestionAll(): void {
    for (const d of this.days) if (!this.draft()[d].length) this.addSuggestion(d);
  }

  protected unusedSlots(day: number): SlotId[] {
    const used = new Set(this.draft()[day].map((r) => r.slot));
    return WeekPlanPage.SLOT_ORDER.filter((s) => !used.has(s));
  }

  /** Default time of a meal: the trainer's times, and around the workout for the meals before and after it. */
  private defaultTime(slot: SlotId): string {
    const workout = toMin(this.store.settings().workoutTime);
    if (slot === 'pre') return fromMin(workout - 60);
    if (slot === 'post') return fromMin(workout + 90);
    return TRAINER_SLOTS.find((x) => x.slot === slot)?.time ?? '12:00';
  }

  protected addMeal(day: number, slot: SlotId): void {
    if (this.draft()[day].some((r) => r.slot === slot)) return;
    const row: Row = { slot, time: this.defaultTime(slot), text: '', name0: '', items0: [] };
    this.draft.update((d) => ({ ...d, [day]: [...d[day], row].sort((a, b) => a.time.localeCompare(b.time)) }));
  }

  protected removeMeal(day: number, slot: SlotId): void {
    this.draft.update((d) => ({ ...d, [day]: d[day].filter((r) => r.slot !== slot) }));
  }

  protected setText(day: number, i: number, e: Event): void {
    this.patch(day, i, { text: inputValue(e) });
  }

  protected setTime(day: number, i: number, time: string): void {
    if (time) this.patch(day, i, { time });
  }

  /** Account first: false (with a message) when the backend did not take it, so nothing is written locally. */
  private async remote(kind: PlanKind, plan: WeekPlan | WorkoutWeekPlan | null): Promise<boolean> {
    this.saving.set(true);
    try {
      return await this.planSync.persist(kind, this.week(), plan);
    } finally {
      this.saving.set(false);
    }
  }

  protected async save(): Promise<void> {
    const plan: WeekPlan = {};
    for (const d of this.days) {
      plan[d] = this.draft()[d]
        .filter((r) => r.text.trim())
        .map((r) => {
          const name = r.text.trim();
          const items = name === r.name0 ? r.items0 : [{ amt: 1, name, amtLabel: '', k: 0, p: 0, c: 0, f: 0 }];
          return { slot: r.slot, time: r.time, name, items };
        })
        .sort((a, b) => a.time.localeCompare(b.time));
    }
    if (!(await this.remote('meal', plan))) return;
    this.day.setWeekPlan(this.week(), plan);
    this.toast.show(t('plan.weeklyPlanSaved'));
  }

  protected setEx(day: number, i: number, field: keyof ExRow, e: Event): void {
    const value = inputValue(e);
    this.wDraft.update((d) => ({ ...d, [day]: d[day].map((r, j) => (j === i ? { ...r, [field]: value } : r)) }));
  }

  protected addEx(day: number): void {
    this.wDraft.update((d) => ({ ...d, [day]: [...d[day], { name: '', sets: '3', min: '8', max: '12' }] }));
  }

  protected removeEx(day: number, i: number): void {
    this.wDraft.update((d) => ({ ...d, [day]: d[day].filter((_, j) => j !== i) }));
  }

  protected setGymDays(days: number[]): void {
    this.wDays.set([...days].sort((a, b) => a - b));
  }

  protected async saveWorkout(): Promise<void> {
    if (!this.wDays().length) {
      this.toast.show(t('plan.chooseAtLeastOneGymDay'));
      return;
    }
    const plan: WorkoutWeekPlan = {};
    for (const d of this.wDays()) {
      const seen = new Set<string>();
      plan[d] = [];
      for (const r of this.wDraft()[d]) {
        const name = r.name.trim().replace(/\s+/g, ' ');
        const id = trainerExId(name);
        if (!name || seen.has(id)) continue;
        seen.add(id);
        const min = clamp(Math.round(parseNum(r.min)) || 8, 1, 100);
        plan[d].push({ id, name, sets: clamp(Math.round(parseNum(r.sets)) || 3, 1, 10), min, max: Math.max(min, Math.round(parseNum(r.max)) || 12) });
      }
    }
    if (!(await this.remote('workout', plan))) return;
    this.plans.saveWorkout(this.week(), plan);
    this.toast.show(t('plan.workoutPlanSaved'));
  }

  protected async clearWorkout(): Promise<void> {
    if (!(await this.remote('workout', null))) return;
    this.plans.clearWorkout(this.week());
    this.toast.show(t('plan.previousWeeksWorkoutRestored'));
  }

  protected async clear(): Promise<void> {
    if (!(await this.remote('meal', null))) return;
    this.day.setWeekPlan(this.week(), null);
    this.toast.show(t('plan.previousWeeksPlanRestored'));
  }

  private patch(day: number, i: number, change: Partial<Row>): void {
    this.draft.update((d) => ({ ...d, [day]: d[day].map((r, j) => (j === i ? { ...r, ...change } : r)) }));
  }

  /** One editable row per saved exercise (at least one blank row per weekday, so a newly chosen gym day starts editable). */
  private toExRows(plan: WorkoutWeekPlan): Record<number, ExRow[]> {
    const rows: Record<number, ExRow[]> = {};
    for (const d of this.days) {
      const list = (plan[d] ?? []).map((e) => ({ name: e.name, sets: String(e.sets), min: String(e.min), max: String(e.max) }));
      rows[d] = list.length ? list : [{ name: '', sets: '3', min: '8', max: '12' }];
    }
    return rows;
  }

  private toRows(plan: WeekPlan): Record<number, Row[]> {
    const rows: Record<number, Row[]> = {};
    for (const d of this.days) {
      rows[d] = (plan[d] ?? []).map((m): Row => ({ slot: m.slot, time: m.time, text: m.name, name0: m.name, items0: m.items })).sort((a, b) => a.time.localeCompare(b.time));
    }
    return rows;
  }
}
