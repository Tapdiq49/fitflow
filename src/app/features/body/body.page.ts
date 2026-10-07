import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { WATER, lineChart, lineSeries, weightChart } from '../../core/charts';
import { BodyService } from '../../core/services/body.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, F, parseNum } from '../../core/utils';
import { ChartComponent } from '../../shared/chart.component';
import { DatePickerComponent } from '../../shared/forms/date-picker.component';
import { IconComponent } from '../../shared/icon.component';
import { BodyBasicsFormComponent } from '../profile/body-basics-form.component';
import { TPipe } from '../../shared/t.pipe';
import { t } from '../../core/i18n/translate';

@Component({
  selector: 'app-body-page',
  imports: [IconComponent, ChartComponent, DatePickerComponent, BodyBasicsFormComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let st = stats();
    @let adv = advice();
    <div class="flex flex-col gap-[18px]">
      @if (!store.bodyBasicsKnown()) {
        <div class="alert alert-info" style="margin-bottom: 14px"><app-icon name="info" /><div class="w-full"><p style="margin: 0 0 10px"><b>{{ 'bodyBasics.title' | t }}</b> {{ 'bodyBasics.why' | t }}</p><app-body-basics-form /></div></div>
      }
      <div class="card">
        <div class="card-head"><h3><app-icon name="plus" /> {{ 'body.addWeightAndWaist' | t }}</h3></div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <div class="field">{{ 'body.date' | t }}<app-date-picker [label]="'body.date' | t" [(value)]="date" [max]="ui.today()" /></div>
          <label class="field">{{ 'common.weightKg' | t }}<input #kg type="text" inputmode="decimal" /></label>
          <label class="field">{{ 'body.waistCmAtNavel' | t }}<input #waist type="text" inputmode="decimal" [placeholder]="'body.optional' | t" /></label>
          <button class="btn btn-primary" style="align-self: end" (click)="add(kg, waist)"><app-icon name="save" size="sm" />{{ 'common.addWeight' | t }}</button>
        </div>
      </div>

      <div class="mb-3.5 grid grid-cols-6 gap-2.5 laptop:grid-cols-3 phone:grid-cols-2">
        <div class="sum-box"><span class="eyebrow">{{ 'body.todaysWeight' | t }}</span><b>{{ st?.today ? F.kg(st?.today?.kg) + ' ' + ('common.kg' | t) : '—' }}</b><small>{{ F.short(ui.viewDate()) }}</small></div>
        <div class="sum-box">
          <span class="eyebrow">{{ 'body.firstWeight' | t }}</span><b>{{ 'common.nKg' | t: { a: F.kg(st ? st.first.kg : startWeight()) } }}</b>
          <small>{{ st ? F.short(st.first.date) : startWeight() != null ? 'ayarlardan' : '' }}</small>
        </div>
        <div class="sum-box"><span class="eyebrow">{{ 'common.currentWeight' | t }}</span><b>{{ st ? F.kg(st.cur.kg) + ' ' + ('common.kg' | t) : '—' }}</b><small>{{ 'body.bmiN' | t: { a: bmi() ?? '—' } }}</small></div>
        <div class="sum-box"><span class="eyebrow">{{ 'body.weeklyAverage' | t }}</span><b>{{ st?.avg7 ? F.kg(st?.avg7) + ' ' + ('common.kg' | t) : '—' }}</b><small>{{ 'body.last7Days' | t }}</small></div>
        <div class="sum-box">
          <span class="eyebrow">{{ 'body.weightChange' | t }}</span><b>{{ st ? F.signed(st.change) + ' ' + ('common.kg' | t) : '—' }}</b>
          <small>{{ st?.rate != null ? F.signed(st!.rate!, 2) + ('body.kgPerWeek' | t) : ('body.noTrend' | t) }}</small>
        </div>
        <div class="sum-box">
          <span class="eyebrow">{{ 'body.waist' | t }}</span><b>{{ st?.waistCur ? F.kg(st?.waistCur) + ' sm' : '—' }}</b>
          <small>{{ st?.waistFirst && st?.waistCur ? F.signed(st!.waistCur! - st!.waistFirst!) + ('body.cmSinceStart' | t) : '' }}</small>
        </div>
      </div>

      <div class="alert" [class]="alertClass[adv.level]">
        <app-icon [name]="adv.level === 'good' ? 'check' : adv.level === 'warn' ? 'alert' : 'info'" />
        <div>
          {{ adv.text }}
          @if (adv.delta) {
            <button class="btn btn-sm" style="margin-left: 6px" (click)="day.adjustKcal(adv.delta)">{{ 'common.setTargetNKcal' | t: { a: F.signed(adv.delta, 0) } }}</button>
          }
          <div class="text-muted" style="margin-top: 4px">
            {{ 'body.goalNotNumberOn' | t }}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
        <div class="card">
          <div class="card-head"><h3>{{ 'body.weightTrend' | t }}</h3></div>
          <app-chart [config]="weightCfg()" [empty]="'common.noWeightEntries' | t" />
        </div>
        <div class="card">
          <div class="card-head"><h3>{{ 'body.waist' | t }}</h3></div>
          <app-chart [config]="waistCfg()" [empty]="'body.noWaistMeasurements' | t" />
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>{{ 'body.history' | t }}</h3></div>
        @if (history().length) {
          <div class="overflow-x-auto" style="border: 0">
            <table class="tbl">
              <thead>
                <tr><th>{{ 'body.date' | t }}</th><th class="tbl-num">{{ 'common.weight' | t }}</th><th class="tbl-num">{{ 'common.waist' | t }}</th><th></th></tr>
              </thead>
              <tbody>
                @for (w of history(); track w.date) {
                  <tr>
                    <td>{{ F.long(w.date) }}</td>
                    <td class="tbl-num">{{ 'common.nKg' | t: { a: F.kg(w.kg) } }}</td>
                    <td class="tbl-num">{{ w.waist ? F.kg(w.waist) + ' sm' : '—' }}</td>
                    <td class="tbl-num">
                      <button class="btn btn-ghost btn-icon btn-sm btn-danger" (click)="remove(w.date)" [attr.aria-label]="'common.delete' | t"><app-icon name="trash" size="sm" /></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty">{{ 'body.noEntriesYet' | t }}</div>
        }
      </div>
    </div>
  `,
})
export class BodyPage {
  protected readonly F = F;
  protected readonly alertClass = { info: 'alert-info', warn: 'alert-warn', good: 'alert-good' };
  protected readonly ui = inject(UiService);
  protected readonly day = inject(DayService);
  private readonly body = inject(BodyService);
  private readonly confirm = inject(ConfirmService);
  protected readonly store = inject(StoreService);

  protected readonly startWeight = computed(() => this.store.settings().startWeight);
  protected readonly stats = computed(() => this.body.stats(this.ui.viewDate()));
  protected readonly advice = computed(() => this.body.advice(this.stats()));
  protected readonly history = computed(() => [...this.body.sorted()].reverse());
  protected readonly bmi = computed(() => {
    const st = this.stats();
    const height = this.store.settings().height;
    if (!st || height == null) return null;
    const h = height / 100;
    return F.r1(st.cur.kg / (h * h));
  });
  protected readonly weightCfg = computed(() => weightChart(this.body.sorted()));
  protected readonly waistCfg = computed(() => {
    const ws = this.body.sorted().filter((w) => w.waist);
    if (!ws.length) return null;
    return lineChart(
      ws.map((w) => DateU.short(w.date)),
      [lineSeries('Bel (sm)', ws.map((w) => w.waist), WATER)],
      ' sm',
    );
  });

  /** The viewed day, but never a day to come: a weight cannot be measured in advance. */
  protected readonly defaultDate = computed(() => (this.ui.viewDate() > this.ui.today() ? this.ui.today() : this.ui.viewDate()));

  /** The day the weight is recorded for; follows the viewed day until the user picks another. */
  protected readonly date = linkedSignal(() => this.defaultDate());

  protected add(kg: HTMLInputElement, waist: HTMLInputElement): void {
    if (this.body.save(this.date() || this.defaultDate(), parseNum(kg.value), parseNum(waist.value))) {
      kg.value = '';
      waist.value = '';
    }
  }

  protected async remove(date: string): Promise<void> {
    if (await this.confirm.ask(t('body.deleteThisWeightEntry'), { confirmLabel: t('common.delete'), danger: true })) this.body.remove(date);
  }
}
