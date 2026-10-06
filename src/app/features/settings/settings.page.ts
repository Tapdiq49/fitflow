import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { MenuMode, Settings } from '../../core/models';
import { ConfirmService } from '../../core/services/confirm.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, inputValue, parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { TimePickerComponent } from '../../shared/time-picker.component';

type NumField = 'height' | 'startWeight' | 'kcalTarget' | 'proteinTarget' | 'mealsPerDay';
type TextField = 'workoutTime' | 'wakeTime' | 'sleepTime' | 'programStart';

@Component({
  selector: 'app-settings-page',
  imports: [IconComponent, TimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="card">
        <div class="card-head"><h3><app-icon name="settings" /> Profil və hədəflər</h3></div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <label class="field">Boy (sm)<input type="text" inputmode="numeric" [value]="form().height" (input)="setNum('height', $event)" /></label>
          <label class="field">Başlanğıc çəki (kq)<input type="text" inputmode="decimal" [value]="form().startWeight" (input)="setNum('startWeight', $event)" /></label>
          <label class="field">Kalori hədəfi (kcal)<input type="text" inputmode="numeric" [value]="form().kcalTarget" (input)="setNum('kcalTarget', $event)" /></label>
          <label class="field">Protein hədəfi (q)<input type="text" inputmode="numeric" [value]="form().proteinTarget" (input)="setNum('proteinTarget', $event)" /></label>
          <label class="field">
            Gündəlik yemək sayı
            <select [value]="form().mealsPerDay" (change)="setNum('mealsPerDay', $event)">
              @for (n of [4, 5, 6]; track n) {
                <option [value]="n">{{ n }}</option>
              }
            </select>
          </label>
          <label class="field">
            Menyu rejimi
            <select [value]="form().menuMode" (change)="setMenuMode($event)">
              <option value="trainer">Trener planı (7 günlük)</option>
              <option value="auto">Avto menyu (kalori/protein hədəfi)</option>
            </select>
          </label>
          <div class="field">Məşq saatı<app-time-picker label="Məşq saatı" [value]="form().workoutTime" (valueChange)="setTime('workoutTime', $event)" /></div>
          <div class="field">Oyanma saatı<app-time-picker label="Oyanma saatı" [value]="form().wakeTime" (valueChange)="setTime('wakeTime', $event)" /></div>
          <div class="field">Yuxu saatı<app-time-picker label="Yuxu saatı" [value]="form().sleepTime" (valueChange)="setTime('sleepTime', $event)" /></div>
          <label class="field">Proqram başlanğıcı (A/B və fazalar)<input type="date" [value]="form().programStart" (input)="setText('programStart', $event)" /></label>
        </div>
        <label class="flex cursor-pointer items-center gap-2" style="margin-top: 14px">
          <input type="checkbox" [checked]="form().useWhey" (change)="setWhey($event)" /> Protein çatmasa menyuya whey əlavə et
        </label>
        <label class="flex cursor-pointer items-center gap-2" style="margin-top: 10px">
          <input type="checkbox" [checked]="form().showCreatine" (change)="setCreatine($event)" /> Kreatini göstər (plan, dashboard, supplements)
        </label>
        <div class="flex flex-wrap items-center gap-2" style="margin-top: 16px">
          <button class="btn btn-primary" (click)="save()"><app-icon name="save" size="sm" />Yadda saxla</button>
          <span class="text-muted" style="font-size: 12px">Yeni hədəflər yeni yaradılan menyulara tətbiq olunur.</span>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3><app-icon name="download" /> Məlumatlar</h3></div>
        <p class="text-text-2" style="margin-top: 0">
          Bütün məlumatlar yalnız bu brauzerin LocalStorage-ində saxlanılır. Brauzeri təmizləməzdən əvvəl ehtiyat nüsxə çıxar.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn" (click)="exportData()"><app-icon name="download" size="sm" />Export (JSON)</button>
          <button class="btn" (click)="file.click()"><app-icon name="upload" size="sm" />Import</button>
          <button class="btn btn-danger" (click)="reset()"><app-icon name="trash" size="sm" />Hamısını sil</button>
          <input #file type="file" accept="application/json" hidden (change)="importData(file)" />
        </div>
      </div>

      <div class="alert alert-warn">
        <app-icon name="shield" />
        <div>
          <b>Vacib:</b> Bu tətbiq ümumi məlumat xarakterlidir və tibbi məsləhəti əvəz etmir. Varikosel əməliyyatından sonra ağır yüklənməyə
          keçməzdən əvvəl uroloqunla məsləhətləş.
        </div>
      </div>
    </div>
  `,
})
export class SettingsPage {
  private readonly store = inject(StoreService);
  private readonly day = inject(DayService);
  private readonly ui = inject(UiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  /** Editable draft, re-synced whenever the stored settings change. */
  protected readonly form = linkedSignal<Settings>(() => ({ ...this.store.settings() }));

  protected setNum(field: NumField, e: Event): void {
    const v = parseNum(inputValue(e));
    if (v > 0) this.form.update((f) => ({ ...f, [field]: v }));
  }

  protected setText(field: TextField, e: Event): void {
    const v = inputValue(e);
    if (v) this.form.update((f) => ({ ...f, [field]: v }));
  }

  protected setTime(field: 'workoutTime' | 'wakeTime' | 'sleepTime', v: string): void {
    if (v) this.form.update((f) => ({ ...f, [field]: v }));
  }

  protected setMenuMode(e: Event): void {
    const v = inputValue(e) as MenuMode;
    if (v === 'auto' || v === 'trainer') this.form.update((f) => ({ ...f, menuMode: v }));
  }

  protected setCreatine(e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.form.update((f) => ({ ...f, showCreatine: on }));
  }

  protected setWhey(e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    this.form.update((f) => ({ ...f, useWhey: on }));
  }

  protected async save(): Promise<void> {
    const f = this.form();
    this.store.updateSettings(f);
    this.toast.show('Ayarlar saxlanıldı ✓');
    if (await this.confirm.ask('Seçilmiş gün üçün menyu yeni ayarlarla yenidən yaradılsın?', { confirmLabel: 'Yenidən yarat' })) this.day.regenerateMenu(this.ui.viewDate());
  }

  protected exportData(): void {
    const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fitflow-backup-${DateU.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  protected importData(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.replace(JSON.parse(String(reader.result)));
        this.day.ensureDay(this.ui.viewDate());
        this.toast.show('Məlumatlar bərpa edildi ✓');
      } catch {
        this.toast.show('Fayl oxunmadı — düzgün FitFlow backup faylı seç');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  protected async reset(): Promise<void> {
    if (!(await this.confirm.ask('Bütün məlumatlar silinsin? Bu geri qaytarıla bilməz.', { confirmLabel: 'Hamısını sil', danger: true }))) return;
    this.store.reset();
    this.ui.goToday();
    this.day.ensureDay(this.ui.today());
    this.toast.show('Məlumatlar silindi');
  }
}
