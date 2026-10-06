import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BloatService } from '../../core/services/bloat.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { F, inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-bloat-quick',
  imports: [IconComponent, RouterLink],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-head">
      <h3><app-icon name="leaf" /> Bu gün köp necədir?</h3>
      <a class="btn btn-sm btn-ghost" routerLink="/digestion">Analiz <app-icon name="right" size="sm" /></a>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-[40px] font-extrabold tabular-nums">{{ bloat.level() }}</span><span class="badge">{{ levelText(bloat.level()) }}</span>
    </div>
    <input type="range" min="0" max="10" step="1" class="h-7 w-full accent-accent" [value]="bloat.level()" (input)="bloat.level.set(+val($event))" aria-label="Köp səviyyəsi 0–10" />
    <div class="flex flex-wrap items-center justify-between gap-2 text-muted" style="font-size: 11px"><span>0 — yoxdur</span><span>10 — çox güclü</span></div>
    <button class="btn btn-primary" style="width: 100%; margin-top: 10px" (click)="save()"><app-icon name="save" size="sm" />Bugünkü yeməklərlə qeyd et</button>
    <p class="text-muted" style="font-size: 12px; margin: 8px 0 0">
      @if (todays().length) {
        Bu gün {{ todays().length }} qeyd var (son: {{ todays()[todays().length - 1].level }}/10).
      } @else {
        Yeyilmiş yeməklərin qidaları avtomatik əlavə olunur.
      }
      @if (triggers().length) {
        <br />⚠ Diqqət:
        @for (t of triggers(); track t.key; let last = $last) {
          <b>{{ t.name }}</b> ({{ F.r1(t.avg) }}/10){{ last ? '' : ', ' }}
        }
      }
    </p>
  `,
})
export class BloatQuickComponent {
  protected readonly F = F;
  protected readonly val = inputValue;
  protected readonly levelText = BloatService.levelText;
  protected readonly bloat = inject(BloatService);
  private readonly store = inject(StoreService);
  private readonly ui = inject(UiService);
  private readonly toast = inject(ToastService);

  protected readonly todays = computed(() => this.store.state().bloat.filter((e) => e.date === this.ui.viewDate()));
  protected readonly triggers = computed(() => this.bloat.stats().filter((x) => x.n >= 2 && x.avg >= 6).slice(0, 3));

  protected save(): void {
    const k = this.ui.viewDate();
    const foods = this.bloat.dayFoods(k);
    if (!foods.length) {
      this.toast.show('Bu gün üçün yemək tapılmadı');
      return;
    }
    this.bloat.save(k, this.bloat.level(), foods, '');
  }
}
