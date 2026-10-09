import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { DayService } from '../../core/services/day.service';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { F, fromMin, toMin } from '../../core/utils';
import { IconComponent } from '../../shared/icon/icon.component';
import { BusyDirective } from '../../common/directives/busy/busy.directive';
import { BUSY } from '../../core/busy-keys';
import { TypeBadgeComponent } from '../../shared/type-badge/type-badge.component';
import { TPipe, TdPipe } from '../../common/pipes/translate/t.pipe';
import { TimePipe } from '../../common/pipes/format/time.pipe';
import { t } from '../../core/i18n/translate';

/** "BU GÜN NƏ ETMƏLİSƏN?" — the time-ordered checklist, score and tip of the day. */
@Component({
  selector: 'app-today-hero',
  imports: [BusyDirective, IconComponent, TypeBadgeComponent, TPipe, TdPipe, TimePipe],
  host: {
    class:
      'card [background:radial-gradient(1200px_300px_at_0%_0%,color-mix(in_oklab,var(--color-accent)_10%,transparent),transparent_60%),var(--color-surface)] p-[26px]! tablet:p-[18px]! phone:p-[14px]!',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-start justify-between gap-5">
      <div>
        <div class="eyebrow">{{ eyebrow() }} · {{ F.long(k()) }}</div>
        <h1 class="mt-1.5 mb-2.5 text-[length:clamp(24px,3.4vw,36px)] font-extrabold tracking-[-.03em]">{{ heading() }}</h1>
        <div class="flex flex-wrap items-center gap-2">
          <app-type-badge [date]="k()" />
          <span class="badge"><app-icon name="target" size="sm" />{{ 'dash.weekNN' | t: { a: phase().wk, b: (phase().name | td) } }}</span>
        </div>
      </div>
      <div class="flex items-center gap-3.5 rounded-[calc(var(--r)_*_16px)] border border-border bg-surface-2 py-3 pr-[18px] pl-3">
        <div
          class="grid size-16 place-items-center rounded-full bg-[conic-gradient(var(--color-accent)_calc(var(--v)*1%),var(--color-surface-3)_0)] [--v:0] [transition:background_.6s] after:size-12 after:rounded-full after:bg-surface-2"
          [style.--v]="score()"
        ></div>
        <div>
          <div class="eyebrow">{{ 'dash.todaysScore' | t }}</div>
          <b class="text-[1.375rem] font-extrabold">{{ score() }}%</b>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5 tablet:grid-cols-[minmax(0,1fr)]">
      <ol class="m-0 flex list-none flex-col gap-1.5 p-0">
        @for (it of items(); track it.id) {
          @let next = nextId() === it.id;
          <li
            class="grid grid-cols-[56px_30px_minmax(0,1fr)] items-center gap-2.5 rounded-[calc(var(--r)_*_12px)] border px-3 py-2.5 [transition:background_.2s,border-color_.2s,opacity_.2s] phone:grid-cols-[46px_28px_minmax(0,1fr)] phone:gap-2 phone:px-2.5 phone:py-[9px]"
            [class]="
              next
                ? 'border-accent/50 [background:linear-gradient(90deg,color-mix(in_oklab,var(--color-accent)_10%,transparent),var(--color-surface-2))]'
                : it.done
                  ? 'border-transparent bg-surface-2 opacity-55'
                  : 'border-transparent bg-surface-2'
            "
          >
            <span class="font-bold tabular-nums" [class]="next ? 'text-accent' : 'text-text-2'">{{ it.time | time }}</span>
            <button
              class="check"
              role="checkbox"
              [attr.aria-checked]="it.done"
              [class.check-on]="it.done"
              [disabled]="it.auto"
              [appBusy]="BUSY.toggle(k(), it.id)"
              [title]="it.auto ? ('dash.markedAutomaticallyAsYou' | t) : ''"
              (click)="toggle(it.id)"
              [attr.aria-label]="'common.completed' | t"
            >
              <app-icon name="check" />
            </button>
            <div class="min-w-0">
              <b class="block font-semibold" [class]="it.done ? 'line-through decoration-muted' : ''">{{ it.label }}</b><small class="block truncate text-[0.75rem] text-muted">{{ it.sub }}</small>
            </div>
          </li>
        }
      </ol>
      <aside class="flex flex-col gap-3 rounded-[calc(var(--r)_*_14px)] border border-border bg-surface-2 p-4">
        <h3 class="flex items-center gap-2 text-[0.875rem] text-accent"><app-icon name="zap" size="sm" /> {{ 'dash.tipOfDay' | t }}</h3>
        <p class="m-0 text-text-2">{{ tip() }}</p>
        @if (type() === 'training') {
          <div class="alert alert-warn">
            <app-icon name="shield" />
            <div>
              <b>{{ 'dash.safetyAfterVaricoceleSurgery' | t }}</b> {{ 'dash.nDontHoldBreath' | t: { a: (phase().text | td) } }}
            </div>
          </div>
        }
        <div class="kv"><span>{{ 'dash.calorieTarget' | t }}</span><b>{{ 'dash.nNKcal' | t: { a: s().kcalTarget - 100, b: s().kcalTarget + 100 } }}</b></div>
        <div class="kv"><span>{{ 'dash.proteinTarget' | t }}</span><b>{{ 'dash.nNG' | t: { a: s().proteinTarget - 10, b: s().proteinTarget + 10 } }}</b></div>
        <div class="kv"><span>{{ 'common.waterTarget' | t }}</span><b>{{ 'dash.nL' | t: { a: F.liters(water()) } }}</b></div>
        <div class="kv"><span>{{ 'dash.sleepTarget' | t }}</span><b>{{ 'dash.79HoursN' | t: { a: s().sleepTime, b: s().wakeTime } }}</b></div>
      </aside>
    </div>
  `,
})
export class TodayHeroComponent {
  protected readonly BUSY = BUSY;
  protected readonly F = F;
  protected readonly ui = inject(UiService);
  private readonly day = inject(DayService);
  private readonly program = inject(ProgramService);
  private readonly store = inject(StoreService);
  private readonly confirm = inject(ConfirmService);
  private readonly workout = inject(WorkoutService);

  protected readonly k = this.ui.viewDate;
  /** Past, today or future relative to the selected day. */
  private readonly when = computed(() => (this.k() < this.ui.today() ? 'past' : this.k() > this.ui.today() ? 'future' : 'today'));
  protected readonly eyebrow = computed(() => ({ past: t('dash.pastDay'), today: t('dash.today'), future: t('dash.upcomingDay') })[this.when()]);
  protected readonly heading = computed(() => ({ past: t('dash.whatDidYouDo'), today: t('dash.whatShouldYouDo'), future: t('dash.whatShouldYouDoThat') })[this.when()]);
  protected readonly s = this.store.settings;
  protected readonly items = computed(() => this.day.timeline(this.k()));
  protected readonly score = computed(() => this.day.score(this.k()) ?? 0);
  protected readonly phase = computed(() => this.program.phase(this.k()));
  protected readonly type = computed(() => this.program.dayType(this.k()));
  protected readonly tip = computed(() => this.day.tip(this.k()));
  protected readonly water = computed(() => this.day.waterTarget(this.k()));

  /** Highlights the next pending item (only for today). */
  protected readonly nextId = computed(() => {
    if (!this.ui.isToday()) return null;
    const from = fromMin(toMin(this.ui.nowHM()) - 30);
    const pending = this.items().filter((i) => !i.done && !i.auto);
    return (pending.find((i) => i.time >= from) ?? pending[0])?.id ?? null;
  });

  protected async toggle(id: string): Promise<void> {
    const k = this.k();
    if (id === 'workout') {
      if (this.workout.get(k).savedAt) {
        // A saved workout is undone as a whole, with the results it wrote into the history: the same as "Reset workout" on the workout page.
        if (await this.confirm.ask(t('workout.resetConfirm'), { confirmLabel: t('workout.resetWorkout'), danger: true })) await this.workout.resetLog(k);
        return;
      }
      if (!this.items().find((i) => i.id === id)?.done && !(await this.confirm.ask(t('dash.markWorkoutAsDone')))) return;
    }
    await this.day.toggle(k, id);
  }
}
