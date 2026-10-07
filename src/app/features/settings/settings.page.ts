import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { authErrorText } from '../../core/auth/auth-errors';
import { AuthStore } from '../../core/auth/auth.store';
import { MenuMode, Settings, ThemeMode, WorkoutMode } from '../../core/models';
import { ConfirmService } from '../../core/services/confirm.service';
import { DayService } from '../../core/services/day.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, inputValue, parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { SelectComponent, SelectOption } from '../../shared/forms/select.component';
import { TimePickerComponent } from '../../shared/forms/time-picker.component';
import { TPipe } from '../../shared/t.pipe';
import { t } from '../../core/i18n/translate';

type NumField = 'height' | 'startWeight' | 'kcalTarget' | 'proteinTarget';
type OptionField = 'mealsPerDay' | 'menuMode' | 'workoutMode' | 'theme';
type TextField = 'workoutTime' | 'wakeTime' | 'sleepTime' | 'programStart';

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, IconComponent, SelectComponent, TimePickerComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="card">
        <div class="card-head"><h3><app-icon name="lock" /> {{ 'auth.account' | t }}</h3></div>
        @if (auth.user(); as u) {
          <p class="text-text-2" style="margin-top: 0">{{ 'auth.signedInAs' | t: { name: u.username ?? u.email } }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <button class="btn" [disabled]="signingOut()" (click)="signOut()">{{ 'auth.signOut' | t }}</button>
          </div>
        } @else if (auth.isGuest()) {
          <p class="text-text-2" style="margin-top: 0"><b>{{ 'auth.guestNoticeTitle' | t }}</b> {{ 'auth.guestNoticeText' | t }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <a class="btn btn-primary" routerLink="/auth/sign-in">{{ 'auth.signIn' | t }}</a>
            <a class="btn" routerLink="/auth/sign-up">{{ 'auth.signUp' | t }}</a>
          </div>
        }
      </div>

      <div class="card">
        <div class="card-head"><h3><app-icon name="settings" /> {{ 'settings.profileAndTargets' | t }}</h3></div>
        <div class="grid grid-cols-4 items-start gap-3 tablet:grid-cols-2 phone:grid-cols-1 [&_[role=combobox]]:h-[42px] [&_input]:h-[42px]">
          <label class="field">{{ 'settings.heightCm' | t }}<input type="text" inputmode="numeric" [value]="form().height" (input)="setNum('height', $event)" /></label>
          <label class="field">{{ 'settings.startingWeightKg' | t }}<input type="text" inputmode="decimal" [value]="form().startWeight" (input)="setNum('startWeight', $event)" /></label>
          <label class="field">{{ 'settings.calorieTargetKcal' | t }}<input type="text" inputmode="numeric" [value]="form().kcalTarget" (input)="setNum('kcalTarget', $event)" /></label>
          <label class="field">{{ 'settings.proteinTargetG' | t }}<input type="text" inputmode="numeric" [value]="form().proteinTarget" (input)="setNum('proteinTarget', $event)" /></label>
          <div class="field">
            {{ 'settings.mealsPerDay' | t }}
            <app-select [label]="'settings.mealsPerDay' | t" [options]="mealCounts" [value]="form().mealsPerDay" (valueChange)="setOption('mealsPerDay', $event)" />
          </div>
          <div class="field">
            {{ 'settings.menuMode' | t }}
            <app-select [label]="'settings.menuMode' | t" [options]="menuModes()" [value]="form().menuMode" (valueChange)="setOption('menuMode', $event)" />
          </div>
          <div class="field">
            {{ 'settings.workoutMode' | t }}
            <app-select [label]="'settings.workoutMode' | t" [options]="workoutModes()" [value]="form().workoutMode" (valueChange)="setOption('workoutMode', $event)" />
          </div>
          <div class="field">
            {{ 'settings.appearance' | t }}
            <app-select [label]="'settings.appearance' | t" [options]="themes()" [value]="form().theme" (valueChange)="setOption('theme', $event)" />
          </div>
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
  protected readonly auth = inject(AuthStore);
  protected readonly signingOut = signal(false);

  /** Editable draft, re-synced whenever the stored settings change. */
  protected readonly form = linkedSignal<Settings>(() => ({ ...this.store.settings() }));

  protected readonly mealCounts: SelectOption<number>[] = [4, 5, 6].map((n) => ({ value: n, label: String(n) }));
  protected readonly menuModes = computed<SelectOption<MenuMode>[]>(() => [
    { value: 'trainer', label: t('settings.trainerPlan') },
    { value: 'auto', label: t('settings.autoMenu') },
  ]);
  protected readonly workoutModes = computed<SelectOption<WorkoutMode>[]>(() => [
    { value: 'program', label: t('settings.builtInProgram') },
    { value: 'trainer', label: t('settings.trainerWorkout') },
  ]);
  protected readonly themes = computed<SelectOption<ThemeMode>[]>(() => [
    { value: 'system', label: t('settings.system') },
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
  ]);

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

  protected setOption<K extends OptionField>(field: K, v: Settings[K]): void {
    this.form.update((f) => ({ ...f, [field]: v }));
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
    const before = this.store.settings();
    this.store.updateSettings(f);
    this.toast.show(t('settings.settingsSaved'));
    const k = this.ui.viewDate();
    if (!this.day.offerMenuRegeneration(before, this.store.settings(), k)) return;
    if (await this.confirm.ask(t('settings.regenerateSelectedDaysMenu'), { confirmLabel: t('settings.regenerate') })) this.day.regenerateMenu(k);
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      this.toast.show(t('auth.signedOut'));
    } catch (e) {
      this.toast.show(authErrorText(e));
    } finally {
      this.signingOut.set(false);
    }
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
