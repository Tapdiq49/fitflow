import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RequiresPermissionDirective } from '../../common/directives/requires-permission/requires-permission.directive';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { lineChart, lineSeries, ACCENT } from '../../core/charts';
import { EXERCISES, HEAVY_LIFTS, PROGRAM, SAFETY } from '../../core/data/program';
import { TRAINER_EX_PREFIX } from '../../core/data/trainer-exercise';
import { Variant } from '../../common/interfaces';
import { ProgramService } from '../../core/services/program.service';
import { RestTimerService } from '../../core/services/rest-timer.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { DateU, F, dayName, inputValue } from '../../core/utils';
import { CardioCardComponent } from '../dashboard/cardio-card.component';
import { ChartComponent } from '../../shared/chart/chart.component';
import { ConfirmService } from '../../core/services/confirm.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { BusyDirective } from '../../common/directives/busy/busy.directive';
import { BUSY } from '../../core/busy-keys';
import { SelectFieldComponent, SelectOption } from '../../shared/forms/select-field/select-field.component';
import { TimePickerComponent } from '../../shared/forms/time-picker/time-picker.component';
import { TPipe, TdPipe } from '../../common/pipes/translate/t.pipe';
import { t } from '../../core/i18n/translate';
import { NumberFieldComponent } from '../../shared/forms/number-field/number-field.component';

@Component({
  selector: 'app-workout-page',
  imports: [NumberFieldComponent, BusyDirective, IconComponent, SelectFieldComponent, TimePickerComponent, ChartComponent, CardioCardComponent, NgTemplateOutlet, RouterLink, RequiresPermissionDirective, TPipe, TdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      @if (variant()) {
        <!-- Sticky under the app header. The opaque wrapper (page background) covers the 12px gap above, the 16px gap
             below and the bar's rounded corners, so scrolled cards never show around the bar. -->
        <div class="sticky top-[var(--header-h,0px)] z-5 -mt-3 bg-bg pt-3 pb-4">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-[18px] py-3.5">
          <div>
            <div class="eyebrow">{{ F.long(k()) }}</div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h3 style="font-size: 1.25rem">{{ workout.title(k()) }}</h3>
              @if (log().savedAt) {
                <span class="badge badge-training"><app-icon name="check" size="sm" />{{ 'workout.saved' | t }}</span>
              }
            </div>
            <span class="text-muted">{{ 'workout.nPerNExercises' | t: { a: doneCount(), b: cards().length } }}</span>
          </div>
          <!-- Trainer mode: bottom-aligned so the button sits on the same line as the captioned time fields. -->
          <div class="flex flex-wrap gap-2" [class]="workout.isTrainer() ? 'items-end [&_.btn]:h-10 [&_[role=combobox]]:h-10' : 'items-center'">
            @if (workout.isTrainer() && !workout.isStale(k())) {
              <div class="flex flex-wrap items-end gap-2">
                <div class="field w-[7.5rem]" [appBusy]="BUSY.workoutTime(k(), 'startTime')">{{ 'workout.started' | t }}<app-time-picker [label]="'workout.started' | t" [value]="log().startTime ?? ''" (valueChange)="workout.setTime(k(), 'startTime', $event)" /></div>
                <div class="field w-[7.5rem]" [appBusy]="BUSY.workoutTime(k(), 'endTime')">{{ 'workout.finished' | t }}<app-time-picker [label]="'workout.finished' | t" [value]="log().endTime ?? ''" (valueChange)="workout.setTime(k(), 'endTime', $event)" /></div>
                @if (duration() != null) {
                  <span class="pb-2 text-[0.9375rem] font-bold text-accent tabular-nums">{{ 'workout.nMin' | t: { n: duration()! } }}</span>
                }
              </div>
            }
            @if (log().savedAt) {
              <!-- The "saved" badge sits next to the title. -->
            } @else if (log().startedAt) {
              <span class="text-[1.375rem] font-extrabold text-accent tabular-nums">{{ elapsed() }}</span>
            } @else if (!workout.isTrainer()) {
              <button class="btn btn-primary" appRequires="workout.edit" [appBusy]="BUSY.workoutStart(k())" (click)="workout.start(k())"><app-icon name="play" size="sm" />{{ 'common.startWorkout' | t }}</button>
            }
            @if (!workout.isStale(k()) || editing()) {
            <button class="btn" appRequires="workout.edit" [class.btn-primary]="!log().savedAt" [appBusy]="BUSY.toggle(k(), 'workout')" (click)="workout.save(k())">
              <app-icon name="save" size="sm" />{{ log().savedAt ? ('workout.saveAgain' | t) : ('workout.saveWorkout' | t) }}
            </button>
            }
            @if (canReset()) {
              <button class="btn btn-ghost" appRequires="workout.edit" [appBusy]="BUSY.toggle(k(), 'workout')" (click)="resetLog()"><app-icon name="refresh" size="sm" />{{ 'workout.resetWorkout' | t }}</button>
            }
          </div>
        </div>
        </div>

        <ng-container *ngTemplateOutlet="safetyTpl" />

        @if (markedFromList()) {
          <div class="alert alert-info mb-4"><app-icon name="info" /><div>{{ 'workout.markedFromChecklist' | t }}</div></div>
        }

        <!-- A saved workout that no longer fits the plan: the current exercises cannot be logged on it, so they are not offered until it is reset. -->
        @if (workout.isStale(k())) {
          <div class="alert alert-warn mb-4">
            <app-icon name="alert" />
            <div class="w-full">
              <p class="m-0 mb-2.5">{{ staleText() }}</p>
              @if (!editing()) {
                <button class="btn btn-sm btn-primary mr-2" appRequires="workout.edit" (click)="editingDate.set(k())"><app-icon name="edit" size="sm" />{{ 'workout.editSaved' | t }}</button>
              }
              <button class="btn btn-sm" appRequires="workout.edit" [appBusy]="BUSY.toggle(k(), 'workout')" (click)="resetLog()"><app-icon name="refresh" size="sm" />{{ 'workout.resetWorkout' | t }}</button>
            </div>
          </div>
          <!-- What was done on that day stays readable, so the user can look it up (the exercises are not editable on this plan). -->
          @if (editing()) {
            <ng-container *ngTemplateOutlet="cardsTpl" />
          } @else if (savedRecord().length) {
            <div class="eyebrow mb-2.5">{{ 'workout.savedRecord' | t }}</div>
            <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
              @for (x of savedRecord(); track x.id) {
                <div class="rounded-card border bg-surface p-4" [class]="x.done ? 'border-good/40' : 'border-border-soft'">
                  <h4 class="text-[1rem] font-bold">{{ x.name }}</h4>
                  <ul class="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                    @for (s of x.sets; track $index) {
                      <li class="flex items-center justify-between gap-3 rounded-[calc(var(--r)_*_8px)] bg-surface-2 px-3 py-1.5 text-[0.875rem] tabular-nums">
                        <span class="font-bold text-muted">{{ $index + 1 }}</span>
                        <span class="font-semibold">{{ s.text }}</span>
                        <span class="w-4 text-good">{{ s.done ? '✓' : '' }}</span>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          }
        } @else {
        @if (!cards().length) {
          <div class="card">
            <div class="empty">
              <app-icon name="info" /><br />{{ 'workout.noTrainerWorkoutWritten' | t }}<br /><br />
              <a class="btn btn-sm" routerLink="/plan">{{ 'workout.goToWeeklyPlan' | t }}</a>
            </div>
          </div>
        }

        <ng-container *ngTemplateOutlet="cardsTpl" />
        }
      } @else {
        <div class="card">
          <div class="empty">
            <app-icon name="info" /><br />{{ F.long(k()) }} — <b>{{ program.typeLabel(type()) }}</b>.<br />
            {{ 'workout.nextGymDay' | t }} <b>{{ next() ? F.long(next()!) + ' — ' + workout.title(next()!) : '—' }}</b>
            @if (next(); as n) {
              <br /><br /><button class="btn btn-sm" (click)="ui.viewDate.set(n)">{{ 'workout.goToThatDay' | t }}</button>
            }
          </div>
        </div>
        @if (type() === 'cardio') {
          <app-cardio-card />
        }
        <ng-container *ngTemplateOutlet="safetyTpl" />
      }

      <div class="card">
        <div class="card-head">
          <h3><app-icon name="trend" /> {{ 'workout.progressChart' | t }}</h3>
          @if (historyIds().length) {
            <app-select-field class="w-[13.75rem] max-w-full" [label]="'workout.progressChart' | t" [options]="chartOptions()" [value]="chartId()!" (valueChange)="selectedChart.set($event)" />
          }
        </div>
        @if (historyIds().length) {
          <app-chart [config]="progressChart()" />
        } @else {
          <div class="empty">{{ 'workout.afterYouSaveWorkout' | t }}</div>
        }
      </div>

      <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
        @if (workout.isTrainer()) {
          @for (d of weekPlan(); track d.date) {
            <div class="card">
              <div class="card-head"><h3>{{ d.label }}</h3></div>
              <div class="flex flex-col gap-2">
                @for (e of d.exercises; track e.id) {
                  <div class="flex justify-between gap-2.5 rounded-[calc(var(--r)_*_10px)] bg-surface-2 px-3 py-[9px] text-[0.8125rem] [&_span:last-child]:text-right [&_span:last-child]:text-text-2">
                    <span>{{ e.ex.name }}</span><span>{{ e.ex.sets }}×{{ e.ex.min }}–{{ e.ex.max }}</span>
                  </div>
                } @empty {
                  <div class="text-muted">{{ 'workout.notWritten' | t }}</div>
                }
              </div>
            </div>
          }
        } @else {
        @for (v of variants; track v) {
          <div class="card">
            <div class="card-head"><h3>{{ 'workout.fullBodyN' | t: { a: v } }}</h3></div>
            <div class="flex flex-col gap-2">
              @for (id of program_[v]; track id) {
                <div class="flex justify-between gap-2.5 rounded-[calc(var(--r)_*_10px)] bg-surface-2 px-3 py-[9px] text-[0.8125rem] [&_span:last-child]:text-right [&_span:last-child]:text-text-2">
                  <span>{{ exName(id) }}</span><span>{{ targetOf(id) }}</span>
                </div>
              }
            </div>
          </div>
        }
        }
      </div>
    </div>

    <ng-template #cardsTpl>
        <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
          @for (c of cards(); track c.id; let idx = $index) {
            <div class="rounded-card border bg-surface p-4 [transition:border-color_.2s]" appRequires="workout.edit" [class]="c.done ? 'border-good/40' : 'border-border-soft'">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span class="eyebrow">{{ idx + 1 }} / {{ cards().length }}</span>
                  <h4 class="text-[1rem] font-bold">{{ c.ex.name }}</h4>
                  <div class="mt-1 text-[0.75rem] text-muted">{{ c.ex.note | td }}</div>
                </div>
                <button class="btn btn-sm" [class.btn-done]="c.done" [appBusy]="BUSY.exercise(k(), c.id)" (click)="workout.toggleExercise(k(), c.id)">
                  <app-icon name="check" size="sm" />{{ c.done ? ('common.completed' | t) : ('workout.completeExercise' | t) }}
                </button>
              </div>
              <div class="my-3 grid grid-cols-3 gap-2 phone:grid-cols-[1fr]">
                <div class="rounded-[calc(var(--r)_*_10px)] bg-surface-2 px-2.5 py-2 text-[0.7813rem]"><span class="text-muted">{{ 'workout.target' | t }}</span><b class="block text-[0.875rem]">{{ 'workout.nSetsNN' | t: { a: c.ex.sets, b: c.ex.min, c: c.ex.max, d: c.timed ? ' ' + ('common.sec' | t) : '' } }}</b></div>
                <div class="rounded-[calc(var(--r)_*_10px)] bg-surface-2 px-2.5 py-2 text-[0.7813rem]">
                  <span class="text-muted">{{ 'workout.lastWorkoutN' | t: { a: c.rec.last ? ' (' + F.short(c.rec.last.date) + ')' : '' } }}</span>
                  <b class="block text-[0.875rem]">{{ workout.lastStr(c.rec.last, c.ex) }}</b>
                </div>
                <div class="rounded-[calc(var(--r)_*_10px)] bg-surface-2 px-2.5 py-2 text-[0.7813rem]"><span class="text-muted">{{ 'workout.nextSuggestion' | t }}</span><b class="block text-[0.875rem] text-accent">{{ c.recLabel }}</b></div>
              </div>
              <div class="mt-1 text-[0.75rem] text-muted" style="margin-bottom: 8px">{{ c.rec.text }}</div>
              <table
                class="w-full border-separate [border-spacing:0_6px] [&_td]:px-1.5 [&_td]:py-0 [&_th]:px-1.5 [&_th]:py-0 [&_th]:text-left [&_th]:text-[0.6875rem] [&_th]:font-semibold [&_th]:tracking-[.06em] [&_th]:text-muted [&_th]:uppercase"
              >
                <thead>
                  <tr>
                    <th>{{ 'workout.set' | t }}</th>
                    @if (!c.timed) {
                      <th>{{ 'common.weightKg' | t }}</th>
                    }
                    <th>{{ c.timed ? ('workout.seconds' | t) : ('workout.reps' | t) }}</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of c.sets; track $index; let i = $index) {
                    <tr>
                      <td class="w-[2.125rem] font-bold text-muted">{{ i + 1 }}</td>
                      @if (!c.timed) {
                        <td>
                          <app-number-field class="w-full" inputClass="text-center font-semibold" decimal [value]="workout.fieldValue(k(), c.id, i, 'w', s.w)" [placeholder]="'common.kg' | t" (input)="workout.setDraft(k(), c.id, i, 'w', val($event))" />
                        </td>
                      }
                      <td>
                        <app-number-field class="w-full" inputClass="text-center font-semibold" [value]="workout.fieldValue(k(), c.id, i, 'r', s.r)" [placeholder]="c.ex.min + '–' + c.ex.max" (input)="workout.setDraft(k(), c.id, i, 'r', val($event))" />
                      </td>
                      <td class="w-10">
                        <button class="check" role="checkbox" [attr.aria-checked]="s.done" [class.check-on]="s.done" [appBusy]="BUSY.set(k(), c.id, i)" (click)="toggleSet(c.id, i)" [attr.aria-label]="'workout.setCompleted' | t"><app-icon name="check" /></button>
                      </td>
                      <td class="w-10">
                        @if (i >= c.ex.sets) {
                          <button class="btn btn-ghost btn-icon btn-sm" [appBusy]="BUSY.set(k(), c.id, i)" (click)="workout.removeSet(k(), c.id, i)" [attr.aria-label]="'workout.deleteSet' | t"><app-icon name="x" size="sm" /></button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <button class="btn btn-ghost btn-sm" [appBusy]="BUSY.addSet(k(), c.id)" (click)="workout.addSet(k(), c.id)"><app-icon name="plus" size="sm" />{{ 'workout.addSet' | t }}</button>
            </div>
          }
        </div>
    </ng-template>

    <ng-template #safetyTpl>
      <div class="alert alert-warn">
        <app-icon name="shield" />
        <div>
          @if (!workout.isTrainer()) {
            <b>{{ 'workout.nWeekNRir' | t: { a: (phase().name | td), b: phase().wk, c: phase().rir } }}</b> {{ phase().text | td }}
          }
          <ul>
            @for (s of safety; track s) {
              <li>{{ s | td }}</li>
            }
          </ul>
        </div>
      </div>
    </ng-template>
  `,
})
export class WorkoutPage {
  protected readonly BUSY = BUSY;
  protected readonly F = F;
  protected readonly val = inputValue;
  protected readonly safety = SAFETY;
  protected readonly variants: Variant[] = ['A', 'B'];
  protected readonly program_ = PROGRAM;

  protected readonly ui = inject(UiService);
  protected readonly program = inject(ProgramService);
  protected readonly workout = inject(WorkoutService);
  private readonly store = inject(StoreService);
  private readonly rest = inject(RestTimerService);
  private readonly confirm = inject(ConfirmService);

  protected readonly k = this.ui.viewDate;
  protected readonly type = computed(() => this.program.dayType(this.k()));
  protected readonly variant = computed(() => this.program.variant(this.k()));
  protected readonly phase = computed(() => this.program.phase(this.k()));
  protected readonly next = computed(() => this.program.nextTraining(this.k()));
  protected readonly log = computed(() => {
    this.store.state();
    return this.workout.get(this.k());
  });

  protected readonly cards = computed(() => {
    const v = this.variant();
    if (!v) return [];
    const log = this.log();
    // A saved workout that does not fit the plan is edited on its own exercises, not on the plan's.
    const planned = this.workout.isStale(this.k()) ? Object.keys(log.ex).map((id) => ({ id, ex: this.workout.defOf(id) })) : this.workout.exercises(this.k());
    return planned.map(({ id, ex }) => {
      const rec = this.workout.recommend(id, this.k());
      const timed = ex.kind === 'time';
      const arrow = rec.kind === 'up' ? '↑ ' : rec.kind === 'down' ? '↓ ' : '';
      return {
        id,
        ex,
        rec,
        timed,
        done: log.ex[id]?.done ?? false,
        sets: log.ex[id]?.sets ?? [],
        recLabel: timed ? t('workout.seconds') : rec.w != null ? `${arrow}${F.kg(rec.w)} ${t('common.kg')}` : this.workout.isTrainer() ? '—' : t('workout.new'),
      };
    });
  });
  /** The viewed week's gym days with the trainer's exercises (trainer mode). */
  protected readonly weekPlan = computed(() => {
    const mon = DateU.monday(this.k());
    return Array.from({ length: 7 }, (_, i) => DateU.add(mon, i))
      .filter((date) => this.program.dayType(date) === 'training')
      .map((date) => ({ date, label: `${dayName(DateU.dow(date) - 1)} · ${DateU.short(date)}`, exercises: this.workout.exercises(date) }));
  });
  protected readonly doneCount = computed(() => this.cards().filter((c) => c.done).length);

  protected readonly duration = computed(() => this.workout.duration(this.log()));

  protected readonly elapsed = computed(() => {
    const started = this.log().startedAt;
    if (!started) return '00:00';
    const s = Math.max(0, Math.floor((this.ui.now() - started) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  protected readonly historyIds = computed(() =>
    Object.keys(this.store.state().history).filter((id) => (EXERCISES[id] || id.startsWith(TRAINER_EX_PREFIX)) && (this.store.state().history[id]?.length ?? 0) > 0),
  );
  protected readonly chartOptions = computed<SelectOption<string>[]>(() => this.historyIds().map((id) => ({ value: id, label: this.exName(id) })));
  protected readonly selectedChart = signal<string | null>(null);
  protected readonly chartId = computed(() => {
    const ids = this.historyIds();
    const sel = this.selectedChart();
    return sel && ids.includes(sel) ? sel : (ids[0] ?? null);
  });
  protected readonly progressChart = computed(() => {
    const id = this.chartId();
    if (!id) return null;
    const ex = this.workout.defOf(id);
    const h = this.store.state().history[id] ?? [];
    const timed = ex.kind === 'time';
    return lineChart(
      h.map((e) => DateU.short(e.date)),
      [lineSeries(timed ? t('workout.longestSetSec') : t('workout.heaviestSetKg'), h.map((e) => Math.max(...e.sets.map((s) => (timed ? s.r : s.w)))), ACCENT)],
      ` ${timed ? t('common.s') : t('common.kg')}`,
    );
  });

  /** The saved log of the viewed day as plain text: each exercise it holds with the sets that have a weight or reps (read-only view). */
  protected readonly savedRecord = computed(() =>
    Object.entries(this.log().ex)
      .map(([id, e]) => {
        const timed = this.workout.defOf(id).kind === 'time';
        const sets = e.sets
          .filter((s) => String(s.w).trim() !== '' || String(s.r).trim() !== '')
          .map((s) => ({ done: s.done, text: timed ? `${s.r || '—'} ${t('common.sec')}` : `${s.w || '—'} ${t('common.kg')} × ${s.r || '—'}` }));
        return { id, name: this.workout.defOf(id).name, done: e.done, sets };
      })
      .filter((x) => x.sets.length),
  );

  /** "Reset workout" is offered as soon as the day holds anything to throw away, not only after saving. */
  protected readonly canReset = computed(() => {
    this.store.state();
    return this.workout.hasProgress(this.k());
  });

  /** The day was ticked off in the checklist ("what should you do today") but no workout was saved: no sets are recorded for it. */
  protected readonly markedFromList = computed(() => !!this.store.state().days[this.k()]?.checks['workout'] && !this.log().savedAt);

  /** Why the saved workout of the viewed day cannot be edited: the mode changed after it was saved, or only its plan did. */
  protected readonly staleText = computed(() => {
    // Today is said as "today", any other day by its date.
    const when = this.k() === this.ui.today() ? t('workout.whenToday') : t('workout.whenDate', { date: F.long(this.k()) });
    const savedTrainer = Object.keys(this.log().ex).some((id) => id.startsWith(TRAINER_EX_PREFIX));
    const nowTrainer = this.workout.isTrainer();
    if (savedTrainer === nowTrainer) return t('workout.staleLog', { when });
    const mode = (trainer: boolean): string => t(trainer ? 'settings.trainerWorkout' : 'settings.builtInProgram');
    return t('workout.staleMode', { when, saved: mode(savedTrainer), now: mode(nowTrainer) });
  });

  protected exName(id: string): string {
    return this.workout.defOf(id).name;
  }

  protected targetOf(id: string): string {
    const e = this.workout.defOf(id);
    return `${e.sets}×${e.min}–${e.max}${e.kind === 'time' ? ` ${t('common.sec')}` : ''}`;
  }

  /** The day whose saved record the user chose to edit (see the warning about a record that does not fit the plan). */
  protected readonly editingDate = signal<string | null>(null);
  protected readonly editing = computed(() => this.editingDate() === this.k());

  protected async resetLog(): Promise<void> {
    if (await this.confirm.ask(t('workout.resetConfirm'), { confirmLabel: t('workout.resetWorkout'), danger: true })) {
      await this.workout.resetLog(this.k());
      this.editingDate.set(null);
    }
  }

  protected async toggleSet(id: string, i: number): Promise<void> {
    if (await this.workout.toggleSet(this.k(), id, i)) {
      const s = this.store.settings();
      this.rest.start(HEAVY_LIFTS.has(id) ? s.restHeavySec : s.restLightSec);
    }
  }
}
