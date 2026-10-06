import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { newDay } from '../../core/models';
import { DayService } from '../../core/services/day.service';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-cardio-card',
  imports: [IconComponent],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (type()) {
      @case ('cardio') {
        <div class="card-head">
          <h3><app-icon name="heart" /> Today's Cardio</h3>
          @if (cardio().done) {
            <span class="badge badge-cardio"><app-icon name="check" size="sm" />Tamamlandı</span>
          }
        </div>
        <div class="flex flex-wrap gap-1.5" style="margin-bottom: 12px">
          <button class="btn btn-sm" [class.btn-active]="cardio().type === 'walk'" (click)="day.setCardio(k(), { type: 'walk' })">Sürətli yerimə · 20–30 dəq</button>
          <button class="btn btn-sm" [class.btn-active]="cardio().type === 'jog'" (click)="day.setCardio(k(), { type: 'jog' })">Yüngül qaçış · 20–25 dəq</button>
        </div>
        <div class="kv"><span>İntensivlik</span><b>Zona 2 · danışa biləcəyin temp</b></div>
        <div class="kv"><span>Nəbz</span><b>~110–135 vurğu/dəq</b></div>
        <div class="kv">
          <span>Qeyd</span>
          <b>{{ cardio().type === 'jog' ? 'Qasıqda diskomfort olarsa yerimə ilə əvəz et' : 'Mailli treadmill (5–8%) əla seçimdir' }}</b>
        </div>
        <div class="flex flex-wrap items-center gap-2" style="margin-top: 12px">
          <label class="field" style="flex: 1">
            Dəqiqə
            <input
              type="text"
              inputmode="numeric"
              [value]="cardio().minutes"
              [placeholder]="cardio().type === 'jog' ? '20–25' : '20–30'"
              (input)="day.setCardio(k(), { minutes: val($event) })"
            />
          </label>
          <button class="btn" [class.btn-done]="cardio().done" [class.btn-primary]="!cardio().done" style="align-self: flex-end" (click)="day.toggleCardio(k())">
            <app-icon name="check" size="sm" />{{ cardio().done ? 'Edildi' : 'Kardionu tamamla' }}
          </button>
        </div>
        <p class="text-muted" style="margin: 10px 0 0; font-size: 12px">Əsas məqsəd əzələ yığmaq olduğu üçün kardionu 30 dəqiqədən artıq etmə.</p>
      }
      @case ('rest') {
        <div class="card-head"><h3><app-icon name="moon" /> Bərpa günü</h3></div>
        <div class="kv"><span>Kardio</span><b>Yoxdur — bərpa</b></div>
        <div class="kv"><span>Hərəkət</span><b>Yüngül gəzinti 6–8 min addım</b></div>
        <div class="kv"><span>Mobility</span><b>10 dəq stretching</b></div>
        <div class="kv"><span>Diqqət</span><b>Yuxu, su, protein</b></div>
      }
      @default {
        <div class="card-head"><h3><app-icon name="heart" /> Today's Cardio</h3></div>
        <div class="empty">Bu gün ayrıca kardio yoxdur.<br />Məşqdən sonra istəsən 5–10 dəq yüngül yerimə (soyuma) et.</div>
      }
    }
  `,
})
export class CardioCardComponent {
  protected readonly val = inputValue;
  protected readonly day = inject(DayService);
  private readonly ui = inject(UiService);
  private readonly program = inject(ProgramService);
  private readonly store = inject(StoreService);

  protected readonly k = this.ui.viewDate;
  protected readonly type = computed(() => this.program.dayType(this.k()));
  protected readonly cardio = computed(() => (this.store.state().days[this.k()] ?? newDay()).cardio);
}
