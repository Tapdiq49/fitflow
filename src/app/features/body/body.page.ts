import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WATER, lineChart, lineSeries, weightChart } from '../../core/charts';
import { BodyService } from '../../core/services/body.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, F, parseNum } from '../../core/utils';
import { ChartComponent } from '../../shared/chart.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-body-page',
  imports: [IconComponent, ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let st = stats();
    @let adv = advice();
    <div class="flex flex-col gap-[18px]">
      <div class="card">
        <div class="card-head"><h3><app-icon name="plus" /> Çəki və bel ölçüsü əlavə et</h3></div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <label class="field">Tarix<input #date type="date" [value]="ui.viewDate()" /></label>
          <label class="field">Çəki (kq)<input #kg type="text" inputmode="decimal" placeholder="99.0" /></label>
          <label class="field">Bel ölçüsü (sm, göbək səviyyəsi)<input #waist type="text" inputmode="decimal" placeholder="istəyə bağlı" /></label>
          <button class="btn btn-primary" style="align-self: end" (click)="add(date.value, kg, waist)"><app-icon name="save" size="sm" />Add weight</button>
        </div>
      </div>

      <div class="mb-3.5 grid grid-cols-6 gap-2.5 laptop:grid-cols-3 phone:grid-cols-2">
        <div class="sum-box"><span class="eyebrow">Bugünkü çəki</span><b>{{ st?.today ? F.kg(st?.today?.kg) + ' kq' : '—' }}</b><small>{{ F.short(ui.viewDate()) }}</small></div>
        <div class="sum-box">
          <span class="eyebrow">İlk çəki</span><b>{{ F.kg(st ? st.first.kg : startWeight()) }} kq</b>
          <small>{{ st ? F.short(st.first.date) : 'ayarlardan' }}</small>
        </div>
        <div class="sum-box"><span class="eyebrow">Cari çəki</span><b>{{ st ? F.kg(st.cur.kg) + ' kq' : '—' }}</b><small>BMI {{ bmi() ?? '—' }}</small></div>
        <div class="sum-box"><span class="eyebrow">Həftəlik orta</span><b>{{ st?.avg7 ? F.kg(st?.avg7) + ' kq' : '—' }}</b><small>son 7 gün</small></div>
        <div class="sum-box">
          <span class="eyebrow">Çəki dəyişimi</span><b>{{ st ? F.signed(st.change) + ' kq' : '—' }}</b>
          <small>{{ st?.rate != null ? F.signed(st!.rate!, 2) + ' kq/həftə' : 'trend yoxdur' }}</small>
        </div>
        <div class="sum-box">
          <span class="eyebrow">Bel ölçüsü</span><b>{{ st?.waistCur ? F.kg(st?.waistCur) + ' sm' : '—' }}</b>
          <small>{{ st?.waistFirst && st?.waistCur ? F.signed(st!.waistCur! - st!.waistFirst!) + ' sm başlanğıcdan' : '' }}</small>
        </div>
      </div>

      <div class="alert" [class]="alertClass[adv.level]">
        <app-icon [name]="adv.level === 'good' ? 'check' : adv.level === 'warn' ? 'alert' : 'info'" />
        <div>
          {{ adv.text }}
          @if (adv.delta) {
            <button class="btn btn-sm" style="margin-left: 6px" (click)="day.adjustKcal(adv.delta)">Hədəfi {{ F.signed(adv.delta, 0) }} kcal et</button>
          }
          <div class="text-muted" style="margin-top: 4px">
            Məqsəd tərəzidə rəqəm deyil: əzələ artımı + bel ölçüsünün sabit qalması. Hər həftə eyni şəraitdə ölç.
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
        <div class="card">
          <div class="card-head"><h3>Çəki trendi</h3></div>
          <app-chart [config]="weightCfg()" empty="Çəki qeydi yoxdur" />
        </div>
        <div class="card">
          <div class="card-head"><h3>Bel ölçüsü</h3></div>
          <app-chart [config]="waistCfg()" empty="Bel ölçüsü qeydi yoxdur" />
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Tarixçə</h3></div>
        @if (history().length) {
          <div class="overflow-x-auto" style="border: 0">
            <table class="tbl">
              <thead>
                <tr><th>Tarix</th><th class="tbl-num">Çəki</th><th class="tbl-num">Bel</th><th></th></tr>
              </thead>
              <tbody>
                @for (w of history(); track w.date) {
                  <tr>
                    <td>{{ F.long(w.date) }}</td>
                    <td class="tbl-num">{{ F.kg(w.kg) }} kq</td>
                    <td class="tbl-num">{{ w.waist ? F.kg(w.waist) + ' sm' : '—' }}</td>
                    <td class="tbl-num">
                      <button class="btn btn-ghost btn-icon btn-sm btn-danger" (click)="remove(w.date)" aria-label="Sil"><app-icon name="trash" size="sm" /></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty">Hələ qeyd yoxdur.</div>
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
  private readonly store = inject(StoreService);

  protected readonly startWeight = computed(() => this.store.settings().startWeight);
  protected readonly stats = computed(() => this.body.stats(this.ui.viewDate()));
  protected readonly advice = computed(() => this.body.advice(this.stats()));
  protected readonly history = computed(() => [...this.body.sorted()].reverse());
  protected readonly bmi = computed(() => {
    const st = this.stats();
    const h = this.store.settings().height / 100;
    return st ? F.r1(st.cur.kg / (h * h)) : null;
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

  protected add(date: string, kg: HTMLInputElement, waist: HTMLInputElement): void {
    if (this.body.save(date || this.ui.viewDate(), parseNum(kg.value), parseNum(waist.value))) {
      kg.value = '';
      waist.value = '';
    }
  }

  protected remove(date: string): void {
    if (confirm('Bu çəki qeydi silinsin?')) this.body.remove(date);
  }
}
