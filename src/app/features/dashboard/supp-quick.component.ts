import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { BusyDirective } from '../../common/directives/busy/busy.directive';
import { BUSY } from '../../core/busy-keys';
import { TPipe } from '../../common/pipes/translate/t.pipe';

@Component({
  selector: 'app-supp-quick',
  imports: [BusyDirective, IconComponent, RouterLink, TPipe],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="pill" /> {{ 'dash.supplements' | t }}</h3>
      <a class="btn btn-sm btn-ghost" routerLink="/supplements">{{ 'dash.details' | t }} <app-icon name="right" size="sm" /></a>
    </div>
    @if (store.settings().showCreatine) {
    <div class="kv">
      <span>{{ 'dash.creatineMonohydrate35' | t }}</span>
      <button class="btn btn-sm" [class.btn-done]="creatine()" [appBusy]="BUSY.toggle(k(), 'creatine')" (click)="day.toggle(k(), 'creatine')">
        <app-icon name="check" size="sm" />{{ creatine() ? ('dash.taken' | t) : ('dash.take' | t) }}
      </button>
    </div>
    }
    <div class="kv">
      <span>{{ 'dash.wheyProteinOnlyTo' | t }}</span>
      <button class="btn btn-sm" [appBusy]="BUSY.menu(k())" (click)="day.addWhey(k())"><app-icon name="plus" size="sm" />{{ 'dash.1Scoop24G' | t }}</button>
    </div>
    <p class="text-muted" style="font-size: 0.75rem; margin: 8px 0 0">
      {{ 'dash.extraWheyTodayN' | t: { a: wheyScoops() } }}
    </p>
  `,
})
export class SuppQuickComponent {
  protected readonly BUSY = BUSY;
  protected readonly day = inject(DayService);
  protected readonly store = inject(StoreService);
  private readonly ui = inject(UiService);

  protected readonly k = this.ui.viewDate;
  private readonly record = computed(() => this.store.state().days[this.k()] ?? null);
  protected readonly creatine = computed(() => !!this.record()?.creatine);
  protected readonly wheyScoops = computed(() =>
    (this.record()?.menu ?? [])
      .filter((m) => m.slot === 'supp')
      .flatMap((m) => m.items)
      .filter((i) => i.food === 'whey')
      .reduce((a, i) => a + i.amt, 0),
  );
}
