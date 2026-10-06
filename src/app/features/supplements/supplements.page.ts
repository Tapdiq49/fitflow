import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { menuTotals } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, F } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-supplements-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
        @if (store.settings().showCreatine) {
        <div class="card">
          <div class="card-head">
            <h3><app-icon name="pill" /> Creatine Monohydrate</h3>
            <span class="badge badge-training">Tövsiyə olunur</span>
          </div>
          <div class="kv"><span>Doza</span><b>3–5 q / gün</b></div>
          <div class="kv"><span>Nə vaxt</span><b>Hər gün — məşq və istirahət günü</b></div>
          <div class="kv"><span>Necə</span><b>Su və ya yeməklə; "loading" lazım deyil</b></div>
          <div class="kv"><span>Son 7 gün</span><b>{{ streak() }} / 7</b></div>
          <div class="flex flex-wrap items-center gap-2" style="gap: 4px; margin: 10px 0">
            @for (d of last7(); track d.k) {
              <span [title]="F.short(d.k)" style="flex: 1; height: 8px; border-radius: 4px" [style.background]="d.on ? 'var(--accent)' : 'var(--surface-3)'"></span>
            }
          </div>
          <button class="btn" style="width: 100%" [class.btn-done]="creatine()" [class.btn-primary]="!creatine()" (click)="day.toggle(k(), 'creatine')">
            <app-icon name="check" size="sm" />{{ creatine() ? 'Bu gün qəbul edildi' : 'Bu gün qəbul etdim' }}
          </button>
          <p class="text-muted" style="font-size: 12px; margin: 10px 0 0">
            Kreatin əzələdə su saxladığı üçün ilk həftələrdə tərəzidə +0.5–1.5 kq görünə bilər — bu yağ deyil.
          </p>
        </div>
        }

        <div class="card">
          <div class="card-head">
            <h3><app-icon name="zap" /> Whey Protein</h3>
            <span class="badge">İstəyə bağlı</span>
          </div>
          <p class="text-text-2" style="margin-top: 0">Whey əsas qida deyil — yalnız yeməklə protein hədəfi tamamlanmadıqda çatışmazlığı doldurmaq üçündür.</p>
          <div class="kv"><span>Bugünkü plan proteini</span><b>{{ F.round(planProtein()) }} / {{ store.settings().proteinTarget }} q</b></div>
          <div class="kv"><span>1 ölçü</span><b>~120 kcal · 24 q protein</b></div>
          <label class="flex cursor-pointer items-center gap-2" style="margin: 12px 0">
            <input type="checkbox" [checked]="store.settings().useWhey" (change)="toggleWhey($event)" />
            Menyu yaradarkən protein çatmasa whey əlavə et
          </label>
          <button class="btn btn-primary" style="width: 100%" (click)="day.addWhey(k())">
            <app-icon name="plus" size="sm" />1 ölçü whey içdim (günlük hesaba əlavə et)
          </button>
        </div>
      </div>

      <div class="alert alert-bad">
        <app-icon name="shield" />
        <div>
          <b>Proqramdan çıxarılıb:</b> steroidlər, testosteron, SARM-lar, prohormonlar və digər anabolik preparatlar. Məqsəd natural nəticədir —
          xüsusən varikosel əməliyyatından sonra hormonal balansı qorumaq vacibdir. Hər hansı əlavə preparat üçün əvvəlcə həkimlə məsləhətləş.
        </div>
      </div>
    </div>
  `,
})
export class SupplementsPage {
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

  protected toggleWhey(e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.store.setUseWhey(on);
    this.toast.show(on ? 'Whey aktiv' : 'Whey deaktiv');
  }
}
