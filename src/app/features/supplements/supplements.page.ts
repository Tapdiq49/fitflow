import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RequiresPermissionDirective } from '../../common/directives/requires-permission/requires-permission.directive';
import { menuTotals } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, F } from '../../core/utils';
import { CheckboxComponent } from '../../shared/forms/checkbox/checkbox.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { BusyDirective } from '../../common/directives/busy/busy.directive';
import { BUSY } from '../../core/busy-keys';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { t } from '../../core/i18n/translate';

@Component({
  selector: 'app-supplements-page',
  imports: [CheckboxComponent, BusyDirective, IconComponent, RequiresPermissionDirective, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
        @if (store.settings().showCreatine) {
        <div class="card" appRequires="supplements.edit">
          <div class="card-head">
            <h3><app-icon name="pill" /> {{ 'supp.creatineMonohydrate' | t }}</h3>
            <span class="badge badge-training">{{ 'supp.recommended' | t }}</span>
          </div>
          <div class="kv"><span>{{ 'supp.dose' | t }}</span><b>{{ 'supp.35GPer' | t }}</b></div>
          <div class="kv"><span>{{ 'supp.when' | t }}</span><b>{{ 'supp.everyDayTrainingAnd' | t }}</b></div>
          <div class="kv"><span>{{ 'supp.how' | t }}</span><b>{{ 'supp.withWaterOrFood' | t }}</b></div>
          <div class="kv"><span>{{ 'supp.last7Days' | t }}</span><b>{{ streak() }} / 7</b></div>
          <div class="flex flex-wrap items-center gap-2" style="gap: 4px; margin: 10px 0">
            @for (d of last7(); track d.k) {
              <span [title]="F.short(d.k)" style="flex: 1; height: 8px; border-radius: calc(var(--r) * 4px)" [style.background]="d.on ? 'var(--accent)' : 'var(--surface-3)'"></span>
            }
          </div>
          <button class="btn" style="width: 100%" [class.btn-done]="creatine()" [class.btn-primary]="!creatine()" [appBusy]="BUSY.toggle(k(), 'creatine')" (click)="day.toggle(k(), 'creatine')">
            <app-icon name="check" size="sm" />{{ creatine() ? ('supp.takenToday' | t) : ('supp.iTookToday' | t) }}
          </button>
          <p class="text-muted" style="font-size: 0.75rem; margin: 10px 0 0">
            {{ 'supp.creatineHoldsWaterIn' | t }}
          </p>
        </div>
        }

        <div class="card" appRequires="supplements.edit">
          <div class="card-head">
            <h3><app-icon name="zap" /> {{ 'supp.wheyProtein' | t }}</h3>
            <span class="badge">{{ 'supp.optional' | t }}</span>
          </div>
          <p class="text-text-2" style="margin-top: 0">{{ 'supp.wheyNotMainFood' | t }}</p>
          <div class="kv"><span>{{ 'supp.todaysPlannedProtein' | t }}</span><b>{{ 'supp.nPerNG' | t: { a: F.round(planProtein()), b: store.settings().proteinTarget } }}</b></div>
          <div class="kv"><span>{{ 'supp.1Scoop' | t }}</span><b>{{ 'supp.120Kcal24G' | t }}</b></div>
          <app-checkbox style="margin: 12px 0" [checked]="store.settings().useWhey" (checkedChange)="toggleWhey($event)">{{ 'supp.addWheyWhenCreating' | t }}</app-checkbox>
          <button class="btn btn-primary" style="width: 100%" [appBusy]="BUSY.menu(k())" (click)="day.addWhey(k())">
            <app-icon name="plus" size="sm" />{{ 'supp.iDrank1Scoop' | t }}
          </button>
        </div>
      </div>

      <div class="alert alert-bad">
        <app-icon name="shield" />
        <div>
          <b>{{ 'supp.excludedFromProgram' | t }}</b> {{ 'supp.steroidsTestosteroneSarmsProhormones' | t }}
        </div>
      </div>
    </div>
  `,
})
export class SupplementsPage {
  protected readonly BUSY = BUSY;
  protected readonly F = F;
  protected readonly day = inject(DayService);
  protected readonly store = inject(StoreService);
  private readonly ui = inject(UiService);
  private readonly toast = inject(ToastService);

  protected readonly k = this.ui.viewDate;
  protected readonly creatine = computed(() => !!this.store.state().days[this.k()]?.creatine);
  protected readonly last7 = computed(() =>
    Array.from({ length: 7 }, (_, i) => {
      const k = DateU.add(this.k(), i - 6);
      return { k, on: !!this.store.state().days[k]?.creatine };
    }),
  );
  protected readonly streak = computed(() => this.last7().filter((d) => d.on).length);
  protected readonly planProtein = computed(() => menuTotals(this.store.state().days[this.k()]?.menu).p);

  protected toggleWhey(on: boolean): void {
    this.store.setUseWhey(on);
    this.toast.show(on ? t('supp.wheyOn') : t('supp.wheyOff'));
  }
}
