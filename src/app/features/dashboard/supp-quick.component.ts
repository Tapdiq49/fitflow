import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-supp-quick',
  imports: [IconComponent, RouterLink],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="pill" /> Supplements</h3>
      <a class="btn btn-sm btn-ghost" routerLink="/supplements">Ətraflı <app-icon name="right" size="sm" /></a>
    </div>
    <div class="kv">
      <span>Creatine Monohydrate 3–5 q</span>
      <button class="btn btn-sm" [class.btn-done]="creatine()" (click)="day.toggle(k(), 'creatine')">
        <app-icon name="check" size="sm" />{{ creatine() ? 'Qəbul edildi' : 'Qəbul et' }}
      </button>
    </div>
    <div class="kv">
      <span>Whey protein (yalnız çatışmazlıq üçün)</span>
      <button class="btn btn-sm" (click)="day.addWhey(k())"><app-icon name="plus" size="sm" />1 ölçü (+24 q P)</button>
    </div>
    <p class="text-muted" style="font-size: 12px; margin: 8px 0 0">
      Bu gün əlavə whey: {{ wheyScoops() }} ölçü. Steroid, testosteron, SARM və digər anabolik preparatlar bu proqramda yoxdur.
    </p>
  `,
})
export class SuppQuickComponent {
  protected readonly day = inject(DayService);
  private readonly store = inject(StoreService);
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
