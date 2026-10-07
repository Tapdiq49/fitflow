import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { authErrorText } from '../../core/auth/auth-errors';
import { AuthStore } from '../../core/auth/auth.store';
import { MenuMode, Settings, ThemeMode, WorkoutMode } from '../../core/models';
import { ConfirmService } from '../../core/services/confirm.service';
import { DayService } from '../../core/services/day.service';
import { SessionService } from '../../core/services/session.service';
import { TrainerPlanService } from '../../core/services/trainer-plan.service';
import { DEFAULT_SETTINGS, SETTINGS_RANGE, StoreService } from '../../core/services/store.service';
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
          @if (!u.username) {
            <p class="text-text-2">{{ 'auth.noUsernameYet' | t }} <a routerLink="/auth/username">{{ 'auth.chooseUsernameTitle' | t }}</a></p>
          }
          <div class="flex flex-wrap items-center gap-2">
            <a class="btn" routerLink="/profile">{{ 'profile.menuProfile' | t }}</a>
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
          <label class="field">{{ 'settings.heightCm' | t }}<input type="text" inputmode="numeric" [value]="form().height ?? ''" [attr.aria-invalid]="errors().height ? 'true' : null" (input)="setNum('height', $event)" />@if (errors().height; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <label class="field">{{ 'settings.startingWeightKg' | t }}<input type="text" inputmode="decimal" [value]="form().startWeight ?? ''" [attr.aria-invalid]="errors().startWeight ? 'true' : null" (input)="setNum('startWeight', $event)" />@if (errors().startWeight; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <label class="field">{{ 'settings.calorieTargetKcal' | t }}<input type="text" inputmode="numeric" [placeholder]="std.kcalTarget" [value]="form().kcalTarget" [attr.aria-invalid]="errors().kcalTarget ? 'true' : null" (input)="setNum('kcalTarget', $event)" />@if (errors().kcalTarget; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <label class="field">{{ 'settings.proteinTargetG' | t }}<input type="text" inputmode="numeric" [placeholder]="std.proteinTarget" [value]="form().proteinTarget" [attr.aria-invalid]="errors().proteinTarget ? 'true' : null" (input)="setNum('proteinTarget', $event)" />@if (errors().proteinTarget; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <div class="field">
            {{ 'settings.mealsPerDay' | t }}
            <!-- One select for both modes: swapping two selects in an @if destroys a half-loaded popup (NG0950). -->
            <app-select [label]="'settings.mealsPerDay' | t" [options]="trainerMode() ? planCounts : mealCounts" [value]="trainerMode() ? planMeals().hi : form().mealsPerDay" [disabled]="trainerMode()" (valueChange)="setOption('mealsPerDay', $event)" />
            @if (trainerMode()) {
              <small class="text-muted">@if (planMeals().lo !== planMeals().hi) { {{ 'settings.mealsVary' | t: { a: planMeals().lo + '–' + planMeals().hi } }} }{{ 'settings.mealsFromTrainerPlan' | t }} <a routerLink="/plan">{{ 'nav.weeklyPlan' | t }}</a></small>
            }
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
          <label class="field" [title]="'settings.perBCycleAnd' | t">{{ 'settings.programStart' | t }}<input type="date" [value]="form().programStart" [attr.aria-invalid]="errors().programStart ? 'true' : null" (input)="setText('programStart', $event)" />@if (errors().programStart; as e) { <small class="text-bad">{{ e }}</small> }</label>
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
  private readonly session = inject(SessionService);
  protected readonly signingOut = signal(false);
  protected readonly std = DEFAULT_SETTINGS;
  private readonly plans = inject(TrainerPlanService);

  /** Meals a day in the trainer plan of this week, fewest and most over the 7 days: in trainer mode the plan decides, not a setting. */
  protected readonly planMeals = computed(() => {
    const plan = this.plans.planFor(DateU.monday(DateU.today()));
    const counts = [1, 2, 3, 4, 5, 6, 7].map((d) => plan[d]?.length ?? 0);
    return { lo: Math.min(...counts), hi: Math.max(...counts) };
  });
  protected readonly trainerMode = computed(() => this.form().menuMode === 'trainer');
  /** A trainer-plan day has 0 to 7 meals. */
  protected readonly planCounts: SelectOption<number>[] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }));
  /** Editable draft, re-synced whenever the stored settings change. */
  protected readonly form = linkedSignal<Settings>(() => ({ ...this.store.settings() }));

  protected readonly mealCounts: SelectOption<number>[] = [3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }));
  protected readonly menuModes = computed<SelectOption<MenuMode>[]>(() => [
    { value: 'auto', label: t('settings.autoMenu') },
    { value: 'trainer', label: t('settings.trainerPlan') },
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

  /** What is typed in the required fields right now (the form keeps the last usable value; the typed text is what gets checked on save). */
  private readonly typed: Partial<Record<NumField | 'programStart', string>> = {};
  /** Message under each required field that failed the last save. */
  protected readonly errors = signal<Partial<Record<NumField | 'programStart', string>>>({});

  private clearError(field: NumField | 'programStart'): void {
    if (this.errors()[field]) this.errors.update(({ [field]: _, ...rest }) => rest);
  }

  protected setNum(field: NumField, e: Event): void {
    const text = inputValue(e);
    this.typed[field] = text;
    this.clearError(field);
    const v = parseNum(text);
    if (v > 0) this.form.update((f) => ({ ...f, [field]: v }));
  }

  protected setText(field: TextField, e: Event): void {
    const v = inputValue(e);
    if (field === 'programStart') {
      this.typed[field] = v;
      this.clearError(field);
    }
    if (v) this.form.update((f) => ({ ...f, [field]: v }));
  }

  /** The numbers with a sensible standard value: an empty field means the standard (see DEFAULT_SETTINGS). */
  private static readonly HAS_STANDARD: readonly NumField[] = ['kcalTarget', 'proteinTarget'];

  /** Height, starting weight and the program start are required; the two targets fall back to the standard when empty. Any out-of-range value is reported, never replaced. */
  private validate(): boolean {
    const errors: Partial<Record<NumField | 'programStart', string>> = {};
    const f = this.form();
    for (const field of Object.keys(SETTINGS_RANGE) as NumField[]) {
      const text = this.typed[field];
      if (SettingsPage.HAS_STANDARD.includes(field) && text !== undefined && !text.trim()) {
        this.form.update((x) => ({ ...x, [field]: DEFAULT_SETTINGS[field] }));
        continue;
      }
      const v = text === undefined ? (f[field] ?? NaN) : parseNum(text);
      const { min, max } = SETTINGS_RANGE[field];
      if (!Number.isFinite(v) || text?.trim() === '') errors[field] = t('settings.required');
      else if (v < min || v > max) errors[field] = t('settings.outOfRange', { min, max });
    }
    if (this.typed.programStart !== undefined && !this.typed.programStart) errors.programStart = t('settings.required');
    this.errors.set(errors);
    return Object.keys(errors).length === 0;
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
    if (!this.validate()) {
      this.toast.show(t('settings.fixFields'));
      return;
    }
    const f = this.form();
    const before = this.store.settings();
    this.store.updateSettings(f);
    for (const k of Object.keys(this.typed) as (keyof typeof this.typed)[]) delete this.typed[k];
    this.toast.show(t('settings.settingsSaved'));
    const k = this.ui.viewDate();
    if (!this.day.offerMenuRegeneration(before, this.store.settings(), k)) return;
    if (await this.confirm.ask(t('settings.regenerateSelectedDaysMenu'), { confirmLabel: t('settings.regenerate') })) this.day.regenerateMenu(k);
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      if (await this.session.signOut()) this.toast.show(t('auth.signedOut'));
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
