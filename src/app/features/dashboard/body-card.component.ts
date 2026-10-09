import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { weightChart } from '../../core/charts';
import { BodyService } from '../../core/services/body.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { F, parseNum } from '../../core/utils';
import { ChartComponent } from '../../shared/chart/chart.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { BusyDirective } from '../../common/directives/busy/busy.directive';
import { BUSY } from '../../core/busy-keys';
import { BodyBasicsFormComponent } from '../profile/body-basics-form.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { NumberFieldComponent } from '../../shared/forms/number-field/number-field.component';
import { FieldValue } from '../../shared/forms/field-base/field-base';

@Component({
  selector: 'app-body-card',
  imports: [NumberFieldComponent, BusyDirective, IconComponent, ChartComponent, BodyBasicsFormComponent, RouterLink, TPipe],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="scale" /> {{ 'dash.bodyProgress' | t }}</h3>
      <a class="btn btn-sm btn-ghost" routerLink="/body">{{ 'dash.details' | t }} <app-icon name="right" size="sm" /></a>
    </div>
    @if (!store.bodyBasicsKnown()) {
      <div class="alert alert-info" style="margin-bottom: 14px"><app-icon name="info" /><div class="w-full"><p style="margin: 0 0 10px"><b>{{ 'bodyBasics.title' | t }}</b> {{ 'bodyBasics.why' | t }}</p><app-body-basics-form /></div></div>
    }
    @let st = stats();
    <div class="mb-3.5 grid grid-cols-3 gap-2.5 phone:grid-cols-2">
      <div class="sum-box">
        <span class="eyebrow">{{ 'common.currentWeight' | t }}</span><b>{{ 'common.nKg' | t: { a: F.kg(st?.cur?.kg) } }}</b>
        <small>{{ 'dash.firstNKg' | t: { a: F.kg(st ? st.first.kg : startWeight()) } }}</small>
      </div>
      <div class="sum-box">
        <span class="eyebrow">{{ 'dash.change' | t }}</span><b>{{ 'common.nKg' | t: { a: st ? F.signed(st.change) : '—' } }}</b>
        <small>{{ 'dash.7DayAvgN' | t: { a: F.kg(st?.avg7) } }}</small>
      </div>
      <div class="sum-box">
        <span class="eyebrow">{{ 'common.waist' | t }}</span><b>{{ st?.waistCur ? F.kg(st?.waistCur) + ' sm' : '—' }}</b>
        <small>{{ st?.waistFirst && st?.waistCur ? F.signed(st!.waistCur! - st!.waistFirst!) + ' sm' : ('dash.enterMeasurement' | t) }}</small>
      </div>
    </div>
    <app-chart [config]="chart()" [small]="true" [empty]="'common.noWeightEntries' | t" />
    <div class="flex flex-wrap items-center gap-2" style="margin-top: 12px">
      <app-number-field #kg style="flex: 1" decimal [placeholder]="'dash.todaysWeightKg' | t" />
      <app-number-field #waist width="110px" decimal [placeholder]="'dash.waistCm' | t" />
      <button class="btn btn-primary" [appBusy]="BUSY.weight(weightDay())" (click)="add(kg, waist)"><app-icon name="plus" size="sm" />{{ 'common.addWeight' | t }}</button>
    </div>
    @let adv = advice();
    <div class="alert" [class]="alertClass[adv.level]" style="margin-top: 12px">
      <app-icon [name]="adv.level === 'good' ? 'check' : adv.level === 'warn' ? 'alert' : 'info'" />
      <div>
        {{ adv.text }}
        @if (adv.delta) {
          <button class="btn btn-sm" style="margin-left: 6px" (click)="day.adjustKcal(adv.delta)">{{ 'common.setTargetNKcal' | t: { a: F.signed(adv.delta, 0) } }}</button>
        }
      </div>
    </div>
  `,
})
export class BodyCardComponent {
  protected readonly BUSY = BUSY;
  protected readonly F = F;
  protected readonly alertClass = { info: 'alert-info', warn: 'alert-warn', good: 'alert-good' };
  protected readonly day = inject(DayService);
  private readonly body = inject(BodyService);
  private readonly ui = inject(UiService);
  protected readonly store = inject(StoreService);

  protected readonly startWeight = computed(() => this.store.settings().startWeight);
  protected readonly stats = computed(() => this.body.stats(this.ui.viewDate()));
  protected readonly advice = computed(() => this.body.advice(this.stats()));
  protected readonly chart = computed(() => weightChart(this.body.sorted()));

  /** The day a weight typed here is recorded for: the viewed day, but never a day to come. */
  protected weightDay(): string {
    return this.ui.viewDate() > this.ui.today() ? this.ui.today() : this.ui.viewDate();
  }

  protected async add(kg: FieldValue, waist: FieldValue): Promise<void> {
    if (await this.body.save(this.weightDay(), parseNum(kg.value), parseNum(waist.value))) {
      kg.value = '';
      waist.value = '';
    }
  }
}
