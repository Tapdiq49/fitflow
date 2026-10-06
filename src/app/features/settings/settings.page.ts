import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { MenuMode, Settings, ThemeMode, WorkoutMode } from '../../core/models';
import { ConfirmService } from '../../core/services/confirm.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, inputValue, parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { TimePickerComponent } from '../../shared/time-picker.component';
import { TPipe } from '../../shared/t.pipe';
import { t } from '../../core/i18n/translate';

type NumField = 'height' | 'startWeight' | 'kcalTarget' | 'proteinTarget' | 'mealsPerDay';
type TextField = 'workoutTime' | 'wakeTime' | 'sleepTime' | 'programStart';

@Component({
  selector: 'app-settings-page',
  imports: [IconComponent, TimePickerComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="card">
        <div class="card-head"><h3><app-icon name="settings" /> {{ 'settings.profileAndTargets' | t }}</h3></div>
        <div class="grid grid-cols-4 items-start gap-3 tablet:grid-cols-2 phone:grid-cols-1 [&_app-time-picker_button]:h-[42px] [&_input]:h-[42px] [&_select]:h-[42px]">
          <label class="field">{{ 'settings.heightCm' | t }}<input type="text" inputmode="numeric" [value]="form().height" (input)="setNum('height', $event)" /></label>
          <label class="field">{{ 'settings.startingWeightKg' | t }}<input type="text" inputmode="decimal" [value]="form().startWeight" (input)="setNum('startWeight', $event)" /></label>
          <label class="field">{{ 'settings.calorieTargetKcal' | t }}<input type="text" inputmode="numeric" [value]="form().kcalTarget" (input)="setNum('kcalTarget', $event)" /></label>
          <label class="field">{{ 'settings.proteinTargetG' | t }}<input type="text" inputmode="numeric" [value]="form().proteinTarget" (input)="setNum('proteinTarget', $event)" /></label>
          <label class="field">
            {{ 'settings.mealsPerDay' | t }}
            <select [value]="form().mealsPerDay" (change)="setNum('mealsPerDay', $event)">
              @for (n of [4, 5, 6]; track n) {
                <option [value]="n">{{ n }}</option>
              }
            </select>
          </label>
          <label class="field">
            {{ 'settings.menuMode' | t }}
            <select [value]="form().menuMode" (change)="setMenuMode($event)">
              <option value="trainer">{{ 'settings.trainerPlan' | t }}</option>
              <option value="auto">{{ 'settings.autoMenu' | t }}</option>
            </select>
          </label>
          <label class="field">
            {{ 'settings.workoutMode' | t }}
            <select [value]="form().workoutMode" (change)="setWorkoutMode($event)">
              <option value="program">{{ 'settings.builtInProgram' | t }}</option>
              <option value="trainer">{{ 'settings.trainerWorkout' | t }}</option>
            </select>
          </label>
          <label class="field">
            {{ 'settings.appearance' | t }}
            <select [value]="form().theme" (change)="setTheme($event)">
              <option value="system">{{ 'settings.system' | t }}</option>
              <option value="light">{{ 'settings.light' | t }}</option>
              <option value="dark">{{ 'settings.dark' | t }}</option>
            </select>
          </label>
          <div class="field">{{ 'settings.workoutTime' | t }}<app-time-picker [label]="'settings.workoutTime' | t" [value]="form().workoutTime" (valueChange)="setTime('workoutTime', $event)" /></div>
          <div class="field">{{ 'settings.wakeUpTime' | t }}<app-time-picker [label]="'settings.wakeUpTime' | t" [value]="form().wakeTime" (valueChange)="setTime('wakeTime', $event)" /></div>
          <div class="field">{{ 'settings.bedtime' | t }}<app-time-picker [label]="'settings.bedtime' | t" [value]="form().sleepTime" (valueChange)="setTime('sleepTime', $event)" /></div>
          <label class="field" [title]="'settings.perBCycleAnd' | t">{{ 'settings.programStart' | t }}<input type="date" [value]="form().programStart" (input)="setText('programStart', $event)" /></label>
        </div>
        <label class="flex cursor-pointer items-center gap-2" style="margin-top: 14px">
          <input type="checkbox" [checked]="form().useWhey" (change)="setWhey($event)" /> {{ 'settings.addWheyToMenu' | t }}
        </label>
        <label class="flex cursor-pointer items-center gap-2" style="margin-top: 10px">
          <input type="checkbox" [checked]="form().showCreatine" (change)="setCreatine($event)" /> {{ 'settings.showCreatinePlanDashboard' | t }}
        </label>
        <div class="flex flex-wrap items-center gap-2" style="margin-top: 16px">
          <button class="btn btn-primary" (click)="save()"><app-icon name="save" size="sm" />{{ 'common.save' | t }}</button>
          <span class="text-muted" style="font-size: 12px">{{ 'settings.newTargetsApplyTo' | t }}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3><app-icon name="download" /> {{ 'settings.data' | t }}</h3></div>
        <p class="text-text-2" style="margin-top: 0">
          {{ 'settings.allDataStoredOnly' | t }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn" (click)="exportData()"><app-icon name="download" size="sm" />{{ 'settings.exportJson' | t }}</button>
          <button class="btn" (click)="file.click()"><app-icon name="upload" size="sm" />{{ 'settings.import' | t }}</button>
          <button class="btn btn-danger" (click)="reset()"><app-icon name="trash" size="sm" />{{ 'settings.deleteAll' | t }}</button>
          <input #file type="file" accept="application/json" hidden (change)="importData(file)" />
        </div>
      </div>

      <div class="alert alert-warn">
        <app-icon name="shield" />
        <div>
          <b>{{ 'settings.important' | t }}</b> {{ 'settings.thisAppProvidesGeneral' | t }}
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

  protected setTheme(e: Event): void {
    const v = inputValue(e) as ThemeMode;
    if (v === 'system' || v === 'light' || v === 'dark') this.form.update((f) => ({ ...f, theme: v }));
  }

  protected setWorkoutMode(e: Event): void {
    const v = inputValue(e) as WorkoutMode;
    if (v === 'program' || v === 'trainer') this.form.update((f) => ({ ...f, workoutMode: v }));
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
    this.toast.show(t('settings.settingsSaved'));
    if (await this.confirm.ask(t('settings.regenerateSelectedDaysMenu'), { confirmLabel: t('settings.regenerate') })) this.day.regenerateMenu(this.ui.viewDate());
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
        this.toast.show(t('settings.dataRestored'));
      } catch {
        this.toast.show(t('settings.fileCouldNotRead'));
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  protected async reset(): Promise<void> {
    if (!(await this.confirm.ask(t('settings.deleteAllDataThis'), { confirmLabel: t('settings.deleteAll'), danger: true }))) return;
    this.store.reset();
    this.ui.goToday();
    this.day.ensureDay(this.ui.today());
    this.toast.show(t('settings.dataDeleted'));
  }
}
