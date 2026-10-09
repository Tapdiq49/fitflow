import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RequiresPermissionDirective } from '../../common/directives/requires-permission/requires-permission.directive';
import { RouterLink } from '@angular/router';
import { authErrorText } from '../../core/auth/auth-errors';
import { AuthStore } from '../../core/auth/auth.store';
import { Goal, MenuMode, Settings, Sex, TargetMode, ThemeMode, WorkoutMode } from '../../common/interfaces';
import { BodyBasicsSyncService } from '../../core/services/body-basics-sync.service';
import { BodyIssue, OBESE_BMI, TargetSuggestion, bmiOf, bodyIssue, plausibleBody, suggestTargets } from '../../core/targets';
import { BodyService } from '../../core/services/body.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { DataSyncService } from '../../core/services/data-sync.service';
import { DayService } from '../../core/services/day.service';
import { SettingsService } from '../../core/services/settings.service';
import { SessionService } from '../../core/services/session.service';
import { TrainerPlanService } from '../../core/services/trainer-plan.service';
import { DEFAULT_SETTINGS, SETTINGS_RANGE, StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { DateU, F, inputValue, parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon/icon.component';
import { DatePickerComponent } from '../../shared/forms/date-picker.component';
import { SelectComponent, SelectOption } from '../../shared/forms/select.component';
import { TimePickerComponent } from '../../shared/forms/time-picker.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { t } from '../../core/i18n/translate';

type NumField = 'height' | 'startWeight' | 'age' | 'kcalTarget' | 'proteinTarget' | 'restHeavySec' | 'restLightSec';
type OptionField = 'mealsPerDay' | 'menuMode' | 'workoutMode' | 'theme' | 'goal' | 'targetMode';

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, IconComponent, DatePickerComponent, SelectComponent, TimePickerComponent, RequiresPermissionDirective, TPipe],
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

      <div class="card" appRequires="settings.edit">
        <div class="card-head"><h3><app-icon name="settings" /> {{ 'settings.profileAndTargets' | t }}</h3></div>
        <div class="grid grid-cols-4 items-start gap-3 tablet:grid-cols-2 phone:grid-cols-1 [&_[role=combobox]]:h-[2.625rem] [&_input]:h-[2.625rem]">
          <label class="field">{{ 'settings.heightCm' | t }}<input type="text" inputmode="numeric" [value]="form().height ?? ''" [attr.aria-invalid]="errors().height ? 'true' : null" (input)="setNum('height', $event)" />@if (errors().height; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <label class="field">{{ 'settings.startingWeightKg' | t }}<input type="text" inputmode="decimal" [value]="form().startWeight ?? ''" [attr.aria-invalid]="errors().startWeight ? 'true' : null" (input)="setNum('startWeight', $event)" />@if (errors().startWeight; as e) { <small class="text-bad">{{ e }}</small> }</label>
          @if (latestLog(); as log) {
            <div class="field">
              {{ 'settings.currentWeightKg' | t }}
              <input type="text" [value]="log.kg" disabled [attr.aria-label]="'settings.currentWeightKg' | t" />
              <small class="text-muted">{{ 'settings.currentWeightHint' | t: { date: F.short(log.date) } }} <a routerLink="/body">{{ 'nav.body' | t }}</a></small>
            </div>
          }
          <label class="field">{{ 'settings.age' | t }}<input type="text" inputmode="numeric" [value]="form().age ?? ''" [attr.aria-invalid]="errors().age ? 'true' : null" (input)="setNum('age', $event)" />@if (errors().age; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <div class="field" role="radiogroup" [attr.aria-label]="'settings.sex' | t">
            {{ 'settings.sex' | t }}
            <div class="flex gap-2">
              @for (o of sexes; track o.value) {
                <button type="button" role="radio" class="btn h-[2.625rem] flex-1" [class.btn-primary]="form().sex === o.value" [attr.aria-checked]="form().sex === o.value" (click)="setSex(o.value)">{{ o.label | t }}</button>
              }
            </div>
            @if (errors().sex; as e) { <small class="text-bad">{{ e }}</small> }
          </div>
          <div class="field">
            {{ 'settings.goal' | t }}
            <app-select [label]="'settings.goal' | t" [options]="goalOptions()" [value]="form().goal" (valueChange)="setOption('goal', $event)" />
          </div>
          <div class="field">
            {{ 'settings.targetMode' | t }}
            <app-select [label]="'settings.targetMode' | t" [options]="targetModes()" [value]="form().targetMode" (valueChange)="setOption('targetMode', $event)" />
          </div>
          <label class="field">{{ 'settings.calorieTargetKcal' | t }}<input type="text" inputmode="numeric" [placeholder]="std.kcalTarget" [disabled]="targetAuto()" [value]="targetAuto() ? suggestion()!.kcal : form().kcalTarget" [attr.aria-invalid]="errors().kcalTarget ? 'true' : null" (input)="setNum('kcalTarget', $event)" />@if (errors().kcalTarget; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <label class="field">{{ 'settings.proteinTargetG' | t }}<input type="text" inputmode="numeric" [placeholder]="std.proteinTarget" [disabled]="targetAuto()" [value]="targetAuto() ? suggestion()!.protein : form().proteinTarget" [attr.aria-invalid]="errors().proteinTarget ? 'true' : null" (input)="setNum('proteinTarget', $event)" />@if (errors().proteinTarget; as e) { <small class="text-bad">{{ e }}</small> }</label>
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
            <app-select [label]="'settings.menuMode' | t" [options]="menuModes()" [disabled]="!!safetyIssue()" [value]="safetyIssue() ? 'trainer' : form().menuMode" (valueChange)="setOption('menuMode', $event)" />
          </div>
          <div class="field">
            {{ 'settings.workoutMode' | t }}
            <app-select [label]="'settings.workoutMode' | t" [options]="workoutModes()" [disabled]="!!safetyIssue()" [value]="safetyIssue() ? 'trainer' : form().workoutMode" (valueChange)="setOption('workoutMode', $event)" />
          </div>
          <label class="field">{{ 'settings.restHeavySec' | t }}<input type="text" inputmode="numeric" [placeholder]="std.restHeavySec" [value]="form().restHeavySec" [attr.aria-invalid]="errors().restHeavySec ? 'true' : null" (input)="setNum('restHeavySec', $event)" />@if (errors().restHeavySec; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <label class="field">{{ 'settings.restLightSec' | t }}<input type="text" inputmode="numeric" [placeholder]="std.restLightSec" [value]="form().restLightSec" [attr.aria-invalid]="errors().restLightSec ? 'true' : null" (input)="setNum('restLightSec', $event)" />@if (errors().restLightSec; as e) { <small class="text-bad">{{ e }}</small> }</label>
          <div class="field">
            {{ 'settings.appearance' | t }}
            <app-select [label]="'settings.appearance' | t" [options]="themes()" [value]="form().theme" (valueChange)="setOption('theme', $event)" />
          </div>
          <div class="field">{{ 'settings.workoutTime' | t }}<app-time-picker [label]="'settings.workoutTime' | t" [value]="form().workoutTime" (valueChange)="setTime('workoutTime', $event)" /></div>
          <div class="field">{{ 'settings.wakeUpTime' | t }}<app-time-picker [label]="'settings.wakeUpTime' | t" [value]="form().wakeTime" (valueChange)="setTime('wakeTime', $event)" /></div>
          <div class="field">{{ 'settings.bedtime' | t }}<app-time-picker [label]="'settings.bedtime' | t" [value]="form().sleepTime" (valueChange)="setTime('sleepTime', $event)" /></div>
          <div class="field" [title]="'settings.perBCycleAnd' | t">{{ 'settings.programStart' | t }}<app-date-picker [label]="'settings.programStart' | t" [value]="form().programStart" (valueChange)="setProgramStart($event)" />@if (errors().programStart; as e) { <small class="text-bad">{{ e }}</small> }</div>
        </div>
        @if (implausible(); as bmi) {
          <div class="alert alert-warn" role="alert" style="margin-top: 14px">
            <app-icon name="alert" />
            <div>{{ 'bodyBasics.implausible' | t: { bmi: bmi } }}</div>
          </div>
        } @else if (safetyIssue(); as issue) {
          <div class="alert alert-bad" role="alert" style="margin-top: 14px">
            <app-icon name="alert" />
            <div><b>{{ 'safety.title' | t }}</b> {{ (issue === 'minor' ? 'safety.minor' : 'safety.underweight') | t }} {{ 'safety.basis' | t: { bmi: basis().bmi, kg: basis().kg } }} {{ 'safety.ownPlan' | t }} <a routerLink="/plan">{{ 'nav.weeklyPlan' | t }}</a></div>
          </div>
        } @else if (suggestion(); as sug) {
          <div class="alert alert-info" style="margin-top: 14px">
            <app-icon name="info" />
            <div class="w-full">
              <b>{{ (targetAuto() ? 'settings.autoTargets' : 'settings.suggestedTargets') | t }}</b>
              {{ 'settings.suggestedTargetsText' | t: { k: sug.kcal, p: sug.protein, bmi: F.r1(sug.bmi) } }}
              @if (sug.goalChanged) {
                <div class="mt-1">{{ 'settings.underweightNoLose' | t }}</div>
              } @else if (sug.bmi >= obeseBmi && sug.goal !== 'lose') {
                <div class="mt-1">{{ 'settings.highBmiHint' | t }}</div>
              }
              <div class="text-muted mt-1" style="font-size: 0.75rem">{{ 'settings.suggestedTargetsNote' | t }}</div>
              @if (!targetAuto()) {
                <button class="btn btn-sm mt-2" (click)="applySuggestion(sug)"><app-icon name="check" size="sm" />{{ 'settings.applyTargets' | t }}</button>
              }
            </div>
          </div>
        }
        <label class="flex cursor-pointer items-center gap-2" style="margin-top: 14px">
          <input type="checkbox" [checked]="form().useWhey" (change)="setWhey($event)" /> {{ 'settings.addWheyToMenu' | t }}
        </label>
        <label class="flex cursor-pointer items-center gap-2" style="margin-top: 10px">
          <input type="checkbox" [checked]="form().showCreatine" (change)="setCreatine($event)" /> {{ 'settings.showCreatinePlanDashboard' | t }}
        </label>
        <div class="flex flex-wrap items-center gap-2" style="margin-top: 16px">
          <button class="btn btn-primary" (click)="save()"><app-icon name="save" size="sm" />{{ 'common.save' | t }}</button>
          <span class="text-muted" style="font-size: 0.75rem">{{ 'settings.newTargetsApplyTo' | t }}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3><app-icon name="download" /> {{ 'settings.data' | t }}</h3></div>
        <p class="text-text-2" style="margin-top: 0">
          {{ 'settings.allDataStoredOnly' | t }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn" appRequires="settings.export" (click)="exportData()"><app-icon name="download" size="sm" />{{ 'settings.exportJson' | t }}</button>
          <button class="btn" appRequires="settings.import" (click)="file.click()"><app-icon name="upload" size="sm" />{{ 'settings.import' | t }}</button>
          <button class="btn btn-danger" appRequires="settings.reset" (click)="reset()"><app-icon name="trash" size="sm" />{{ 'settings.deleteAll' | t }}</button>
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
  protected readonly obeseBmi = OBESE_BMI;
  protected readonly F = F;
  private readonly body = inject(BodyService);
  private readonly plans = inject(TrainerPlanService);
  private readonly basicsSync = inject(BodyBasicsSyncService);
  private readonly data = inject(DataSyncService);
  private readonly settings = inject(SettingsService);

  /** Meals a day in the trainer plan of this week, fewest and most over the 7 days: in trainer mode the plan decides, not a setting. */
  protected readonly planMeals = computed(() => {
    const plan = this.plans.planFor(DateU.monday(DateU.today()));
    const counts = [1, 2, 3, 4, 5, 6, 7].map((d) => plan[d]?.length ?? 0);
    return { lo: Math.min(...counts), hi: Math.max(...counts) };
  });
  protected readonly trainerMode = computed(() => !!this.safetyIssue() || this.form().menuMode === 'trainer');
  /** A trainer-plan day has 0 to 7 meals. */
  protected readonly planCounts: SelectOption<number>[] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }));
  /** Editable draft, re-synced whenever the stored settings change. */
  protected readonly form = linkedSignal<Settings>(() => ({ ...this.store.settings() }));

  /** Two buttons instead of a dropdown: a person whose sex is not entered yet has no option to show as selected. */
  protected readonly sexes: { value: Sex; label: string }[] = [
    { value: 'male', label: 'settings.sexMale' },
    { value: 'female', label: 'settings.sexFemale' },
  ];
  protected readonly goalOptions = computed<SelectOption<Goal>[]>(() => [
    { value: 'lose', label: t('settings.goalLose') },
    { value: 'maintain', label: t('settings.goalMaintain') },
    { value: 'gain', label: t('settings.goalGain') },
  ]);

  /** Calories and protein worked out from the form's body data and goal; null while something they need is missing. */
  /** The newest weight logged on the Body page; shown as the current weight, which every check and target uses instead of the starting weight. */
  protected readonly latestLog = computed(() => this.body.sorted().filter((w) => w.date <= DateU.today()).at(-1) ?? null);

  /** The weight the checks use (the newest logged one, else the starting weight in the form) and the BMI it gives. */
  protected readonly basis = computed(() => {
    const f = this.form();
    const kg = this.body.latestKg() ?? f.startWeight;
    return { kg, bmi: f.height != null && kg != null ? Math.round(bmiOf(f.height, kg) * 10) / 10 : null };
  });

  /** The BMI (rounded) when the height and weight in the form cannot belong to one person; null otherwise. Nothing is suggested then. */
  protected readonly implausible = computed<number | null>(() => {
    const f = this.form();
    const weight = this.body.latestKg() ?? f.startWeight;
    if (f.height == null || weight == null || plausibleBody(f.height, weight)) return null;
    return Math.round(bmiOf(f.height, weight));
  });

  /** Whether the body data in the form is one the app must not advise on (a minor, or a dangerously low BMI). */
  protected readonly safetyIssue = computed<BodyIssue | null>(() => {
    const f = this.form();
    const weight = this.body.latestKg() ?? f.startWeight;
    if (f.height == null || weight == null || f.age == null || this.implausible() !== null) return null;
    return bodyIssue(f.height, weight, f.age);
  });

  protected readonly suggestion = computed<TargetSuggestion | null>(() => {
    const f = this.form();
    const weight = this.body.latestKg() ?? f.startWeight;
    if (f.height == null || weight == null || f.age == null || f.sex == null || this.safetyIssue() || this.implausible() !== null) return null;
    return suggestTargets({ height: f.height, weight, age: f.age, sex: f.sex, goal: f.goal });
  });

  protected readonly targetModes = computed<SelectOption<TargetMode>[]>(() => [
    { value: 'auto', label: t('settings.targetAuto') },
    { value: 'custom', label: t('settings.targetCustom') },
  ]);
  /** The calorie and protein fields are not typed by the user: they follow the body data and the goal. */
  protected readonly targetAuto = computed(() => this.form().targetMode === 'auto' && this.suggestion() !== null);

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
  protected readonly errors = signal<Partial<Record<NumField | 'programStart' | 'sex', string>>>({});

  private clearError(field: NumField | 'programStart' | 'sex'): void {
    if (this.errors()[field]) this.errors.update(({ [field]: _, ...rest }) => rest);
  }

  protected setNum(field: NumField, e: Event): void {
    const text = inputValue(e);
    this.typed[field] = text;
    this.clearError(field);
    const v = parseNum(text);
    if (v > 0) this.form.update((f) => ({ ...f, [field]: v }));
  }

  protected setSex(value: Sex): void {
    this.form.update((f) => ({ ...f, sex: value }));
    this.clearError('sex');
  }

  /** Puts the suggested calories and protein in the form (still saved only with the Save button). */
  protected applySuggestion(sug: TargetSuggestion): void {
    delete this.typed.kcalTarget;
    delete this.typed.proteinTarget;
    this.clearError('kcalTarget');
    this.clearError('proteinTarget');
    this.form.update((f) => ({ ...f, kcalTarget: sug.kcal, proteinTarget: sug.protein }));
  }

  protected setProgramStart(v: string): void {
    this.typed.programStart = v;
    this.clearError('programStart');
    if (v) this.form.update((f) => ({ ...f, programStart: v }));
  }

  /** The numbers with a sensible standard value: an empty field means the standard (see DEFAULT_SETTINGS). */
  private static readonly HAS_STANDARD: readonly NumField[] = ['kcalTarget', 'proteinTarget', 'restHeavySec', 'restLightSec'];

  /** Height, starting weight, age, sex and the program start are required; the two targets fall back to the standard when empty. Any out-of-range value is reported, never replaced. */
  private validate(): boolean {
    const errors: Partial<Record<NumField | 'programStart' | 'sex', string>> = {};
    const f = this.form();
    if (!f.sex) errors.sex = t('settings.required');
    for (const field of Object.keys(SETTINGS_RANGE) as NumField[]) {
      if (this.targetAuto() && (field === 'kcalTarget' || field === 'proteinTarget')) continue; // worked out, not typed
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
    const height = errors.height ? NaN : this.typed.height !== undefined ? parseNum(this.typed.height) : (f.height ?? NaN);
    const weight = errors.startWeight ? NaN : this.typed.startWeight !== undefined ? parseNum(this.typed.startWeight) : (f.startWeight ?? NaN);
    if (Number.isFinite(height) && Number.isFinite(weight) && !plausibleBody(height, weight)) errors.startWeight = t('bodyBasics.implausible', { bmi: Math.round(bmiOf(height, weight)) });
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
    const sug = this.suggestion();
    if (this.targetAuto() && sug) this.form.update((x) => ({ ...x, kcalTarget: sug.kcal, proteinTarget: sug.protein }));
    const f = this.form();
    const before = this.store.settings();
    // Height, weight, age and sex live in the account: it takes them first, and nothing is saved here if it refuses.
    const bodyChanged = f.height !== before.height || f.startWeight !== before.startWeight || f.age !== before.age || f.sex !== before.sex;
    if (bodyChanged && f.height != null && f.startWeight != null && f.age != null && f.sex != null) {
      if (!(await this.basicsSync.persist({ height: f.height, startWeight: f.startWeight, age: f.age, sex: f.sex }))) return;
    }
    // Past days are frozen in the account first when the timeline settings change; nothing is saved if the account refuses.
    if (!(await this.settings.save(f))) return;
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
    reader.onload = async () => {
      try {
        // For a signed-in user the backup is saved to the account first; nothing is replaced here if the account refuses.
        if (await this.data.replaceAll(JSON.parse(String(reader.result)))) {
          this.day.ensureDay(this.ui.viewDate());
          this.toast.show(t('settings.dataRestored'));
        }
      } catch {
        this.toast.show(t('settings.fileCouldNotRead'));
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  protected async reset(): Promise<void> {
    const message = t('settings.deleteAllDataThis') + (this.auth.user() ? '\n\n' + t('settings.deleteAllAccountNote') : '');
    if (!(await this.confirm.ask(message, { confirmLabel: t('settings.deleteAll'), danger: true }))) return;
    if (!(await this.data.clearAll())) return; // the account refused: nothing was deleted
    this.ui.goToday();
    this.day.ensureDay(this.ui.today());
    this.toast.show(t('settings.dataDeleted'));
  }
}
