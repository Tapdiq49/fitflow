import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { weightChart } from '../../core/charts';
import { BodyService } from '../../core/services/body.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { F, parseNum } from '../../core/utils';
import { ChartComponent } from '../../shared/chart.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-body-card',
  imports: [IconComponent, ChartComponent, RouterLink],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="scale" /> Body Progress</h3>
      <a class="btn btn-sm btn-ghost" routerLink="/body">Ətraflı <app-icon name="right" size="sm" /></a>
    </div>
    @let st = stats();
    <div class="mb-3.5 grid grid-cols-3 gap-2.5 phone:grid-cols-2">
      <div class="sum-box">
        <span class="eyebrow">Cari çəki</span><b>{{ F.kg(st?.cur?.kg) }} kq</b>
        <small>ilk: {{ F.kg(st ? st.first.kg : startWeight()) }} kq</small>
      </div>
      <div class="sum-box">
        <span class="eyebrow">Dəyişim</span><b>{{ st ? F.signed(st.change) : '—' }} kq</b>
        <small>7 gün orta: {{ F.kg(st?.avg7) }}</small>
      </div>
      <div class="sum-box">
        <span class="eyebrow">Bel</span><b>{{ st?.waistCur ? F.kg(st?.waistCur) + ' sm' : '—' }}</b>
        <small>{{ st?.waistFirst && st?.waistCur ? F.signed(st!.waistCur! - st!.waistFirst!) + ' sm' : 'ölçü daxil et' }}</small>
      </div>
    </div>
    <app-chart [config]="chart()" [small]="true" empty="Çəki qeydi yoxdur" />
    <div class="flex flex-wrap items-center gap-2" style="margin-top: 12px">
      <input #kg type="text" inputmode="decimal" placeholder="Bugünkü çəki (kq)" style="flex: 1" />
      <input #waist type="text" inputmode="decimal" placeholder="Bel (sm)" style="width: 110px" />
      <button class="btn btn-primary" (click)="add(kg, waist)"><app-icon name="plus" size="sm" />Add weight</button>
    </div>
    @let adv = advice();
    <div class="alert" [class]="alertClass[adv.level]" style="margin-top: 12px">
      <app-icon [name]="adv.level === 'good' ? 'check' : adv.level === 'warn' ? 'alert' : 'info'" />
      <div>
        {{ adv.text }}
        @if (adv.delta) {
          <button class="btn btn-sm" style="margin-left: 6px" (click)="day.adjustKcal(adv.delta)">Hədəfi {{ F.signed(adv.delta, 0) }} kcal et</button>
        }
      </div>
    </div>
  `,
})
export class BodyCardComponent {
  protected readonly F = F;
  protected readonly alertClass = { info: 'alert-info', warn: 'alert-warn', good: 'alert-good' };
  protected readonly day = inject(DayService);
  private readonly body = inject(BodyService);
  private readonly ui = inject(UiService);
  private readonly store = inject(StoreService);

  protected readonly startWeight = computed(() => this.store.settings().startWeight);
  protected readonly stats = computed(() => this.body.stats(this.ui.viewDate()));
  protected readonly advice = computed(() => this.body.advice(this.stats()));
  protected readonly chart = computed(() => weightChart(this.body.sorted()));

  protected add(kg: HTMLInputElement, waist: HTMLInputElement): void {
    if (this.body.save(this.ui.viewDate(), parseNum(kg.value), parseNum(waist.value))) {
      kg.value = '';
      waist.value = '';
    }
  }
}
