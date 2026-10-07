import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { SLOTS } from '../../core/data/meals';
import { TRAINER_SLOTS, trainerExId } from '../../core/data/trainer-plan';
import { MealItem, SlotId, WeekPlan, WorkoutWeekPlan } from '../../core/models';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { TrainerPlanService } from '../../core/services/trainer-plan.service';
import { DateU, clamp, dayName, inputValue, parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { TimePickerComponent } from '../../shared/time-picker.component';
import { TPipe } from '../../shared/t.pipe';
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
  imports: [IconComponent, TimePickerComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="flex gap-2">
        <button class="btn" [class.btn-primary]="tab() === 'meal'" (click)="tab.set('meal')"><app-icon name="utensils" size="sm" />{{ 'plan.mealPlan' | t }}</button>
        <button class="btn" [class.btn-primary]="tab() === 'workout'" (click)="tab.set('workout')"><app-icon name="dumbbell" size="sm" />{{ 'plan.workoutPlan' | t }}</button>
      </div>
      <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 rounded-[12px] border border-border-soft bg-surface p-1">
            <button class="btn btn-ghost btn-icon" (click)="shift(-1)" [attr.aria-label]="'plan.previousWeek' | t"><app-icon name="left" /></button>
            <span class="px-2.5 font-semibold whitespace-nowrap">{{ label() }}</span>
            <button class="btn btn-ghost btn-icon" (click)="shift(1)" [attr.aria-label]="'plan.nextWeek' | t"><app-icon name="right" /></button>
          </div>
          <span class="badge" [class.badge-training]="currentOwn()">{{ currentOwn() ? ('plan.planWrittenForThis' | t) : ('plan.previousWeeksPlanIn' | t) }}</span>
        </div>
        @if (tab() === 'meal') {
        <p class="text-muted" style="font-size: 12px; margin: 10px 0 0">
          {{ 'plan.leaveMealFieldEmpty' | t }}
        </p>
        } @else {
          <p class="text-muted" style="font-size: 12px; margin: 10px 0 0">
            {{ 'plan.enterExercisesTrainerGave' | t }}
          </p>
          @if (store.settings().workoutMode !== 'trainer') {
            <p class="mt-2 mb-0 text-[12px] text-warn">{{ 'plan.workoutModeCurrentlyBuilt' | t }}</p>
          }
        }
      </div>

      @if (tab() === 'meal') {
      @for (day of days; track day) {
        <div class="card">
          <div class="card-head"><h3>{{ dayLabel(day) }}</h3></div>
          @for (r of draft()[day]; track r.slot; let i = $index) {
            <div class="mb-2 grid grid-cols-[110px_112px_1fr] items-center gap-2 phone:grid-cols-[90px_1fr]">
              <span class="text-[13px] text-text-2">{{ slotLabel(r.slot) }}</span>
              <app-time-picker [label]="'common.time' | t" [value]="r.time" (valueChange)="setTime(day, i, $event)" />
              <input type="text" [value]="r.text" (input)="setText(day, i, $event)" [placeholder]="'plan.eGBuckwheat4' | t" class="phone:col-span-2" />
            </div>
          }
        </div>
      }

      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" (click)="save()"><app-icon name="save" size="sm" />{{ 'plan.savePlan' | t }}</button>
        @if (own()) {
          <button class="btn btn-danger" (click)="clear()"><app-icon name="trash" size="sm" />{{ 'plan.revertToPreviousWeeksPlan' | t }}</button>
        }
      </div>
      } @else {
        <div class="card">
          <div class="card-head"><h3><app-icon name="calendar" /> {{ 'plan.gymDays' | t }}</h3></div>
          <div class="flex flex-wrap gap-2">
            @for (d of days; track d) {
              <button class="btn btn-sm" [class.btn-primary]="wDays().includes(d)" [attr.aria-pressed]="wDays().includes(d)" (click)="toggleGymDay(d)">{{ dayName(d - 1) }}</button>
            }
          </div>
          <p class="text-muted" style="font-size: 12px; margin: 10px 0 0">{{ 'plan.gymDaysHint' | t }}</p>
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
          <button class="btn btn-primary" (click)="saveWorkout()"><app-icon name="save" size="sm" />{{ 'plan.saveWorkoutPlan' | t }}</button>
          @if (wOwn()) {
            <button class="btn btn-danger" (click)="clearWorkout()"><app-icon name="trash" size="sm" />{{ 'plan.revertToPreviousWeeks' | t }}</button>
          }
        </div>
      }
    </div>
  `,
})
export class WeekPlanPage {
  private readonly plans = inject(TrainerPlanService);
  private readonly day = inject(DayService);
  private readonly toast = inject(ToastService);

  protected readonly store = inject(StoreService);
  protected readonly tab = signal<'meal' | 'workout'>('meal');
  protected readonly days = [1, 2, 3, 4, 5, 6, 7];
  protected readonly dayName = dayName;
  protected readonly week = signal(DateU.monday(DateU.today()));
  protected readonly own = computed(() => this.plans.hasOwn(this.week()));
  protected readonly label = computed(() => `${DateU.short(this.week())} – ${DateU.short(DateU.add(this.week(), 6))}`);

  protected readonly wOwn = computed(() => this.plans.hasOwnWorkout(this.week()));
  protected readonly currentOwn = computed(() => (this.tab() === 'meal' ? this.own() : this.wOwn()));
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

  protected setText(day: number, i: number, e: Event): void {
    this.patch(day, i, { text: inputValue(e) });
  }

  protected setTime(day: number, i: number, time: string): void {
    if (time) this.patch(day, i, { time });
  }

  protected save(): void {
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

  protected toggleGymDay(d: number): void {
    this.wDays.update((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b)));
  }

  protected saveWorkout(): void {
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
    this.plans.saveWorkout(this.week(), plan);
    this.toast.show(t('plan.workoutPlanSaved'));
  }

  protected clearWorkout(): void {
    this.plans.clearWorkout(this.week());
    this.toast.show(t('plan.previousWeeksWorkoutRestored'));
  }

  protected clear(): void {
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
      rows[d] = TRAINER_SLOTS.map(({ slot, time }) => {
        const m = (plan[d] ?? []).find((x) => x.slot === slot);
        return { slot, time: m?.time ?? time, text: m?.name ?? '', name0: m?.name ?? '', items0: m?.items ?? [] };
      });
    }
    return rows;
  }
}
