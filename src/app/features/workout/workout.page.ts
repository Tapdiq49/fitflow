import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { lineChart, lineSeries, ACCENT } from '../../core/charts';
import { EXERCISES, HEAVY_LIFTS, PROGRAM, SAFETY } from '../../core/data/program';
import { TRAINER_EX_PREFIX } from '../../core/data/trainer-plan';
import { Variant } from '../../core/models';
import { ProgramService } from '../../core/services/program.service';
import { RestTimerService } from '../../core/services/rest-timer.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { WorkoutService } from '../../core/services/workout.service';
import { AZ_DAYS, DateU, F, inputValue } from '../../core/utils';
import { CardioCardComponent } from '../dashboard/cardio-card.component';
import { ChartComponent } from '../../shared/chart.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-workout-page',
  imports: [IconComponent, ChartComponent, CardioCardComponent, NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      @if (variant()) {
        <div
          class="sticky top-0 z-5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface/92 px-[18px] py-3.5 backdrop-blur-[10px]"
        >
          <div>
            <div class="eyebrow">{{ F.long(k()) }}</div>
            <h3 style="font-size: 20px">{{ workout.title(k()) }}</h3>
            <span class="text-muted">{{ doneCount() }}/{{ cards().length }} hərəkət tamamlandı</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            @if (log().savedAt) {
              <span class="badge badge-training"><app-icon name="check" size="sm" />Saxlanılıb</span>
            } @else if (log().startedAt) {
              <span class="text-[22px] font-extrabold text-accent tabular-nums">{{ elapsed() }}</span>
            } @else {
              <button class="btn btn-primary" (click)="workout.start(k())"><app-icon name="play" size="sm" />Start workout</button>
            }
            <button class="btn" [class.btn-primary]="!log().savedAt" (click)="workout.save(k())">
              <app-icon name="save" size="sm" />{{ log().savedAt ? 'Yenidən saxla' : 'Save workout' }}
            </button>
          </div>
        </div>

        <ng-container *ngTemplateOutlet="safetyTpl" />

        @if (!cards().length) {
          <div class="card">
            <div class="empty">
              <app-icon name="info" /><br />Bu gün üçün trener məşqi yazılmayıb.<br /><br />
              <a class="btn btn-sm" routerLink="/plan">Həftə planına keç</a>
            </div>
          </div>
        }

        <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
          @for (c of cards(); track c.id; let idx = $index) {
            <div class="rounded-card border bg-surface p-4 [transition:border-color_.2s]" [class]="c.done ? 'border-good/40' : 'border-border-soft'">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span class="eyebrow">{{ idx + 1 }} / {{ cards().length }}</span>
                  <h4 class="text-[16px] font-bold">{{ c.ex.name }}</h4>
                  <div class="mt-1 text-[12px] text-muted">{{ c.ex.note }}</div>
                </div>
                <button class="btn btn-sm" [class.btn-done]="c.done" (click)="workout.toggleExercise(k(), c.id)">
                  <app-icon name="check" size="sm" />{{ c.done ? 'Tamamlandı' : 'Complete exercise' }}
                </button>
              </div>
              <div class="my-3 grid grid-cols-3 gap-2 phone:grid-cols-[1fr]">
                <div class="rounded-[10px] bg-surface-2 px-2.5 py-2 text-[12.5px]"><span class="text-muted">Hədəf</span><b class="block text-[14px]">{{ c.ex.sets }} set × {{ c.ex.min }}–{{ c.ex.max }}{{ c.timed ? ' san' : '' }}</b></div>
                <div class="rounded-[10px] bg-surface-2 px-2.5 py-2 text-[12.5px]">
                  <span class="text-muted">Son məşq{{ c.rec.last ? ' (' + F.short(c.rec.last.date) + ')' : '' }}</span>
                  <b class="block text-[14px]">{{ workout.lastStr(c.rec.last, c.ex) }}</b>
                </div>
                <div class="rounded-[10px] bg-surface-2 px-2.5 py-2 text-[12.5px]"><span class="text-muted">Növbəti tövsiyə</span><b class="block text-[14px] text-accent">{{ c.recLabel }}</b></div>
              </div>
              <div class="mt-1 text-[12px] text-muted" style="margin-bottom: 8px">{{ c.rec.text }}</div>
              <table
                class="w-full border-separate [border-spacing:0_6px] [&_td]:px-1.5 [&_td]:py-0 [&_th]:px-1.5 [&_th]:py-0 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-[.06em] [&_th]:text-muted [&_th]:uppercase"
              >
                <thead>
                  <tr>
                    <th>Set</th>
                    @if (!c.timed) {
                      <th>Çəki (kq)</th>
                    }
                    <th>{{ c.timed ? 'Saniyə' : 'Təkrar' }}</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of c.sets; track $index; let i = $index) {
                    <tr>
                      <td class="w-[34px] font-bold text-muted">{{ i + 1 }}</td>
                      @if (!c.timed) {
                        <td>
                          <input class="w-full text-center font-semibold" type="text" inputmode="decimal" [value]="s.w" [placeholder]="c.rec.w != null ? F.kg(c.rec.w) : 'kq'" (input)="workout.setValue(k(), c.id, i, 'w', val($event))" />
                        </td>
                      }
                      <td>
                        <input class="w-full text-center font-semibold" type="text" inputmode="numeric" [value]="s.r" [placeholder]="c.ex.min + '–' + c.ex.max" (input)="workout.setValue(k(), c.id, i, 'r', val($event))" />
                      </td>
                      <td class="w-10">
                        <button class="check" [class.check-on]="s.done" (click)="toggleSet(c.id, i)" aria-label="Set tamamlandı"><app-icon name="check" /></button>
                      </td>
                      <td class="w-10">
                        @if (i >= c.ex.sets) {
                          <button class="btn btn-ghost btn-icon btn-sm" (click)="workout.removeSet(k(), c.id, i)" aria-label="Seti sil"><app-icon name="x" size="sm" /></button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <button class="btn btn-ghost btn-sm" (click)="workout.addSet(k(), c.id)"><app-icon name="plus" size="sm" />Add set</button>
            </div>
          }
        </div>
      } @else {
        <div class="card">
          <div class="empty">
            <app-icon name="info" /><br />{{ F.long(k()) }} — <b>{{ program.typeLabel(type()) }}</b>.<br />
            Növbəti zal günü: <b>{{ next() ? F.long(next()!) + ' — ' + workout.title(next()!) : '—' }}</b>
            @if (next(); as n) {
              <br /><br /><button class="btn btn-sm" (click)="ui.viewDate.set(n)">O günə keç</button>
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
          <h3><app-icon name="trend" /> Progress chart</h3>
          @if (historyIds().length) {
            <select [value]="chartId()" (change)="selectedChart.set(val($event))">
              @for (id of historyIds(); track id) {
                <option [value]="id">{{ exName(id) }}</option>
              }
            </select>
          }
        </div>
        @if (historyIds().length) {
          <app-chart [config]="progressChart()" />
        } @else {
          <div class="empty">Məşq saxladıqdan sonra burada hər hərəkətin irəliləyişi görünəcək.</div>
        }
      </div>

      <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
        @if (workout.isTrainer()) {
          @for (d of weekPlan(); track d.date) {
            <div class="card">
              <div class="card-head"><h3>{{ d.label }}</h3></div>
              <div class="flex flex-col gap-2">
                @for (e of d.exercises; track e.id) {
                  <div class="flex justify-between gap-2.5 rounded-[10px] bg-surface-2 px-3 py-[9px] text-[13px] [&_span:last-child]:text-right [&_span:last-child]:text-text-2">
                    <span>{{ e.ex.name }}</span><span>{{ e.ex.sets }}×{{ e.ex.min }}–{{ e.ex.max }}</span>
                  </div>
                } @empty {
                  <div class="text-muted">Yazılmayıb</div>
                }
              </div>
            </div>
          }
        } @else {
        @for (v of variants; track v) {
          <div class="card">
            <div class="card-head"><h3>FULL BODY {{ v }}</h3></div>
            <div class="flex flex-col gap-2">
              @for (id of program_[v]; track id) {
                <div class="flex justify-between gap-2.5 rounded-[10px] bg-surface-2 px-3 py-[9px] text-[13px] [&_span:last-child]:text-right [&_span:last-child]:text-text-2">
                  <span>{{ exName(id) }}</span><span>{{ targetOf(id) }}</span>
                </div>
              }
            </div>
          </div>
        }
        }
      </div>
    </div>

    <ng-template #safetyTpl>
      <div class="alert alert-warn">
        <app-icon name="shield" />
        <div>
          @if (!workout.isTrainer()) {
            <b>{{ phase().name }} (həftə {{ phase().wk }}) — RIR {{ phase().rir }}.</b> {{ phase().text }}
          }
          <ul>
            @for (s of safety; track s) {
              <li>{{ s }}</li>
            }
          </ul>
        </div>
      </div>
    </ng-template>
  `,
})
export class WorkoutPage {
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
    return this.workout.exercises(this.k()).map(({ id, ex }) => {
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
        recLabel: timed ? 'Saniyə' : rec.w != null ? `${arrow}${F.kg(rec.w)} kq` : this.workout.isTrainer() ? '—' : 'Yeni',
      };
    });
  });
  /** The viewed week's gym days with the trainer's exercises (trainer mode). */
  protected readonly weekPlan = computed(() => {
    const mon = DateU.monday(this.k());
    return Array.from({ length: 7 }, (_, i) => DateU.add(mon, i))
      .filter((date) => this.program.dayType(date) === 'training')
      .map((date) => ({ date, label: `${AZ_DAYS[DateU.dow(date) - 1]} · ${DateU.short(date)}`, exercises: this.workout.exercises(date) }));
  });
  protected readonly doneCount = computed(() => this.cards().filter((c) => c.done).length);

  protected readonly elapsed = computed(() => {
    const started = this.log().startedAt;
    if (!started) return '00:00';
    const s = Math.max(0, Math.floor((this.ui.now() - started) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  protected readonly historyIds = computed(() =>
    Object.keys(this.store.state().history).filter((id) => (EXERCISES[id] || id.startsWith(TRAINER_EX_PREFIX)) && (this.store.state().history[id]?.length ?? 0) > 0),
  );
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
      [lineSeries(timed ? 'Ən uzun set (san)' : 'Ən ağır set (kq)', h.map((e) => Math.max(...e.sets.map((s) => (timed ? s.r : s.w)))), ACCENT)],
      timed ? ' s' : ' kq',
    );
  });

  protected exName(id: string): string {
    return this.workout.defOf(id).name;
  }

  protected targetOf(id: string): string {
    const e = this.workout.defOf(id);
    return `${e.sets}×${e.min}–${e.max}${e.kind === 'time' ? ' san' : ''}`;
  }

  protected toggleSet(id: string, i: number): void {
    if (this.workout.toggleSet(this.k(), id, i)) this.rest.start(HEAVY_LIFTS.has(id) ? 150 : 90);
  }
}
