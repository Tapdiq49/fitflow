import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Lang, TemplateKey } from '../../common/interfaces';
import { SLOTS } from '../../core/data/meals';
import { MIN_SEARCH_LENGTH, Page, PagedQuery, pageSlice, pagedResource } from '../../core/paging';
import { MealRepository, MealRow } from '../../core/repositories/meal.repository';
import { MAX_MEAL_ITEMS, MEAL_SLOTS, MealCatalogService, MealEntry, mealEntryOf } from '../../core/services/meal-catalog.service';
import { FoodCatalogService } from '../../core/services/food-catalog.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { F, inputValue, parseNum } from '../../core/utils';
import { foodNameOf } from '../../core/food-book';
import { TableCellDirective } from '../../common/directives/table-cell/table-cell.directive';
import { CheckboxComponent } from '../../shared/forms/checkbox/checkbox.component';
import { NumberFieldComponent } from '../../shared/forms/number-field/number-field.component';
import { SelectFieldComponent, SelectOption } from '../../shared/forms/select-field/select-field.component';
import { TextFieldComponent } from '../../shared/forms/text-field/text-field.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { DataTableComponent, TableColumn } from '../../shared/table/data-table.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { t, td } from '../../core/i18n/translate';

interface Row {
  food: string;
  amt: string;
}

const BLANK_ROW: Row = { food: '', amt: '' };
const ALL = 'all';
const NONE = '';

/** The editable form state; the amounts stay text while the person types. */
interface Draft {
  az: string;
  en: string;
  ru: string;
  slot: TemplateKey;
  main: string;
  light: boolean;
  items: Row[];
}

const blank = (slot: TemplateKey = 'breakfast'): Draft => ({ az: '', en: '', ru: '', slot, main: NONE, light: false, items: [{ ...BLANK_ROW }] });

/**
 * The meal reference list: the meal templates the menu generator and the weekly plan draw from. Everyone reads them; a person whose role
 * holds `meals.edit` can add, change and delete them (the backend checks the permission again). Opened from the reference index.
 */
@Component({
  selector: 'app-meal-references-page',
  imports: [TextFieldComponent, NumberFieldComponent, SelectFieldComponent, CheckboxComponent, RouterLink, DataTableComponent, IconComponent, PaginationComponent, TableCellDirective, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div><a routerLink="/references" class="btn btn-ghost btn-sm"><app-icon name="left" size="sm" />{{ 'nav.references' | t }}</a></div>

      @if (canEdit()) {
        <div class="card" #form>
          <div class="card-head"><h3><app-icon [name]="editingId() ? 'edit' : 'plus'" /> {{ (editingId() ? 'references.editMeal' : 'references.addMeal') | t }}</h3></div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] items-start gap-3 [&_[role=combobox]]:h-[2.625rem] [&_input]:h-[2.625rem]">
            <label class="field">{{ 'references.nameAz' | t }}<app-text-field [value]="draft().az" (input)="setText('az', $event)" /></label>
            <label class="field">{{ 'references.nameEn' | t }}<app-text-field [value]="draft().en" (input)="setText('en', $event)" /></label>
            <label class="field">{{ 'references.nameRu' | t }}<app-text-field [value]="draft().ru" (input)="setText('ru', $event)" /></label>
            <div class="field">{{ 'references.mealSlot' | t }}<app-select-field [label]="'references.mealSlot' | t" [options]="slotOptions()" [value]="draft().slot" (valueChange)="patch({ slot: $event })" /></div>
            <div class="field">{{ 'references.mealMain' | t }}<app-select-field [label]="'references.mealMain' | t" [options]="mainOptions()" [value]="draft().main" (valueChange)="patch({ main: $event })" /></div>
          </div>
          <app-checkbox class="mt-3 block" [checked]="draft().light" (checkedChange)="patch({ light: $event })">{{ 'references.mealLight' | t }}</app-checkbox>

          <div class="eyebrow mt-4 mb-2">{{ 'references.mealFoods' | t }}</div>
          <div class="flex flex-col gap-2">
            @for (r of draft().items; track $index; let i = $index) {
              <div class="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-2 [&_[role=combobox]]:h-[2.625rem] [&_input]:h-[2.625rem]">
                <app-select-field [label]="'references.mealFood' | t" [options]="foodOptions()" [value]="r.food" [placeholder]="'references.mealFood' | t" (valueChange)="setRow(i, { food: $event })" />
                <app-number-field decimal [value]="r.amt" [placeholder]="unitOf(r.food) || ('references.mealAmount' | t)" [label]="'references.mealAmount' | t" (input)="setAmount(i, $event)" />
                <button class="btn btn-ghost btn-icon btn-sm" [attr.aria-label]="'references.removeFoodRow' | t" [disabled]="draft().items.length === 1" (click)="removeRow(i)"><app-icon name="trash" size="sm" /></button>
              </div>
            }
          </div>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button class="btn btn-sm" [disabled]="draft().items.length >= maxItems" (click)="addRow()"><app-icon name="plus" size="sm" />{{ 'references.addFoodRow' | t }}</button>
            <span class="text-muted" style="font-size: 0.8125rem">{{ 'references.mealTotals' | t: { k: totals().k, p: totals().p } }}</span>
          </div>
          <div class="mt-3">
            <button class="btn btn-primary" [disabled]="busy()" (click)="save()">@if (busy()) { <span class="spinner"></span> } @else { <app-icon [name]="editingId() ? 'save' : 'plus'" size="sm" /> }{{ (editingId() ? 'common.save' : 'references.add') | t }}</button>
            @if (editingId()) {
              <button class="btn" style="margin-left: 8px" [disabled]="busy()" (click)="cancelEdit()">{{ 'common.cancel' | t }}</button>
            }
          </div>
        </div>
      } @else {
        <div class="alert alert-info"><app-icon name="info" /><div>{{ 'references.mealsReadOnly' | t }}</div></div>
      }

      <div class="card">
        <div class="card-head">
          <h3><app-icon name="utensils" /> {{ 'references.meals' | t }}</h3>
          <span class="badge">{{ total() }}</span>
        </div>
        <p class="text-muted" style="font-size: 0.75rem; margin: 0 0 12px">{{ 'references.mealsHint' | t }}</p>
        @if (catalog.loadFailed()) {
          <div class="alert alert-warn mb-3" role="status"><app-icon name="alert" /><div>{{ 'references.loadFailed' | t }}</div></div>
        }
        <div class="mb-3 grid grid-cols-[minmax(0,1fr)_12rem] gap-2 phone:grid-cols-1 [&_[role=combobox]]:h-[2.625rem]">
          <app-text-field class="w-full" clearable [value]="q.searchInput()" (input)="q.setSearch(val($event))" [placeholder]="'references.searchMeal' | t" [label]="'references.searchMeal' | t" />
          <app-select-field [label]="'references.mealSlot' | t" [options]="slotFilterOptions()" [value]="slotFilter()" (valueChange)="setSlotFilter($event)" />
        </div>
        <p class="text-muted mb-3" style="font-size: 0.75rem; margin: -6px 0 12px">@if (searchTooShort()) { {{ 'references.searchMin' | t: { n: minSearch } }} }</p>
        <app-data-table [columns]="columns()" [rows]="view().rows" [rowKey]="rowKey" [emptyText]="'references.nothingFound' | t" [loading]="catalog.loading() || list.loading()" [loadingLabel]="'common.loading' | t">
          <ng-template appTableCell="actions" let-e>
            @if (canEdit()) {
              <button class="btn btn-ghost btn-icon btn-sm" (click)="edit(e)" [attr.aria-label]="('references.edit' | t) + ': ' + e.name"><app-icon name="edit" size="sm" /></button>
              <button class="btn btn-ghost btn-icon btn-sm" (click)="remove(e)" [attr.aria-label]="('common.delete' | t) + ': ' + e.name"><app-icon name="trash" size="sm" /></button>
            }
          </ng-template>
        </app-data-table>
        @if (total() > 0) {
          <app-pagination [page]="q.page()" [pageSize]="q.pageSize()" [total]="total()" (pageChange)="q.setPage($event)" (pageSizeChange)="q.setPageSize($event)" />
        }
      </div>
    </div>
  `,
})
export class MealReferencesPage {
  protected readonly val = inputValue;
  protected readonly maxItems = MAX_MEAL_ITEMS;

  protected readonly catalog = inject(MealCatalogService);
  private readonly foods = inject(FoodCatalogService);
  private readonly perms = inject(PermissionService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  /** The edit controls: the backend refuses a write from anyone else, this only hides what would fail. */
  protected readonly canEdit = computed(() => this.perms.can('meals.edit'));
  protected readonly busy = signal(false);

  protected readonly slotFilter = signal<string>(ALL);
  private readonly slot = computed<TemplateKey | null>(() => (this.slotFilter() === ALL ? null : (this.slotFilter() as TemplateKey)));

  /** Page, page size and search; the backend answers each combination and a new one cancels the request still running. */
  protected readonly q = new PagedQuery();
  protected readonly minSearch = MIN_SEARCH_LENGTH;
  protected readonly searchTooShort = computed(() => {
    const n = this.q.searchInput().trim().length;
    return n > 0 && n < MIN_SEARCH_LENGTH;
  });

  private readonly repo = inject(MealRepository);
  protected readonly list = pagedResource<MealRow>(this.q, {
    // Reading the pool here makes a change of the pool filter a new request.
    request: (p) => this.repo.request(p, this.slot()),
    parse: (body, headers, p) => this.repo.parse(body, headers, p),
  });

  /** The backend page; the same page cut from the working list while the backend cannot be reached. */
  protected readonly view = computed<Page<MealEntry>>(() => {
    const server = this.list.view();
    if (server && !this.list.failed() && !this.list.idle()) return { rows: server.rows.map(mealEntryOf), total: server.total };
    const slot = this.slot();
    return pageSlice(this.catalog.entries().filter((e) => !slot || e.slot === slot), this.q.params(), (e) => e.name);
  });
  protected readonly total = computed(() => this.view().total ?? this.view().rows.length);

  constructor() {
    // A page that no longer exists (rows deleted, a shorter list) goes back to the last one.
    effect(() => {
      const total = this.total();
      untracked(() => this.q.clampTo(total));
    });
  }

  protected setSlotFilter(slot: string): void {
    this.slotFilter.set(slot);
    this.q.setPage(1);
  }

  protected readonly rowKey = (e: MealEntry): string => e.id;

  protected readonly columns = computed<TableColumn<MealEntry>[]>(() => [
    { id: 'name', header: t('references.meals'), class: 'tbl-text', value: (e) => e.name },
    { id: 'slot', header: t('references.mealSlot'), value: (e) => td(SLOTS[e.slot].label) },
    { id: 'foods', header: t('references.mealFoods'), class: 'tbl-text', value: (e) => this.summary(e) },
    { id: 'k', header: t('addMeal.kcal'), class: 'tbl-num', value: (e) => F.round(e.macros.k) },
    { id: 'p', header: t('dash.protein'), class: 'tbl-num', value: (e) => F.round(e.macros.p) },
    { id: 'actions', header: '', class: 'text-right' },
  ]);

  protected readonly slotOptions = computed<SelectOption<TemplateKey>[]>(() => MEAL_SLOTS.map((s) => ({ value: s, label: td(SLOTS[s].label) })));
  protected readonly slotFilterOptions = computed<SelectOption<string>[]>(() => [{ value: ALL, label: t('references.allSlots') }, ...this.slotOptions()]);

  /** The system foods a meal can be made of (the menu generator reads only these). */
  private readonly systemFoodEntries = computed(() => this.foods.entries().filter((e) => e.isSystem));
  protected readonly foodOptions = computed<SelectOption<string>[]>(() => this.systemFoodEntries().map((e) => ({ value: e.id, label: e.name })));
  protected readonly mainOptions = computed<SelectOption<string>[]>(() => [{ value: NONE, label: t('references.mealMainNone') }, ...this.foodOptions()]);

  protected unitOf(food: string): string {
    const e = this.systemFoodEntries().find((x) => x.id === food);
    return e ? td(e.unit) : '';
  }

  private summary(e: MealEntry): string {
    return e.items.map(([food, amt]) => `${foodNameOf(food)} ${amt}`).join(', ');
  }

  // ---- the form -----------------------------------------------------------------------------------------------------------------------

  protected readonly draft = signal<Draft>(blank());
  /** Code of the template being changed in the form; null = the form adds a new one. */
  protected readonly editingId = signal<string | null>(null);
  private readonly form = viewChild<ElementRef<HTMLElement>>('form');

  protected readonly totals = computed(() => {
    const items = this.draft().items.filter((r) => r.food && parseNum(r.amt) > 0).map((r): [string, number] => [r.food, parseNum(r.amt)]);
    const m = this.catalog.macrosOf(items);
    return { k: F.round(m.k), p: F.round(m.p) };
  });

  protected setText(field: 'az' | 'en' | 'ru', e: Event): void {
    const value = inputValue(e);
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected patch(change: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  protected setRow(i: number, change: Partial<Row>): void {
    this.draft.update((d) => ({ ...d, items: d.items.map((r, j) => (j === i ? { ...r, ...change } : r)) }));
  }

  protected setAmount(i: number, e: Event): void {
    this.setRow(i, { amt: inputValue(e) });
  }

  protected addRow(): void {
    this.draft.update((d) => ({ ...d, items: [...d.items, { ...BLANK_ROW }] }));
  }

  protected removeRow(i: number): void {
    this.draft.update((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((_, j) => j !== i) : d.items }));
  }

  /** Fills the form with a template, to change it. */
  protected edit(e: MealEntry): void {
    const names = this.catalog.row(e.id)?.names ?? e.names;
    this.draft.set({
      az: names.az ?? '',
      en: names.en ?? '',
      ru: names.ru ?? '',
      slot: e.slot,
      main: e.main ?? NONE,
      light: e.light,
      items: e.items.map(([food, amt]) => ({ food, amt: String(amt) })),
    });
    this.editingId.set(e.id);
    this.form()?.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.draft.set(blank(this.draft().slot));
  }

  /** The form adds a new template, or saves the changes of the one being edited. */
  protected async save(): Promise<void> {
    if (this.busy()) return;
    const d = this.draft();
    const id = this.editingId();
    const meal = {
      names: { az: d.az, en: d.en, ru: d.ru } as Partial<Record<Lang, string>>,
      slot: d.slot,
      main: d.main || null,
      light: d.light,
      items: d.items.filter((r) => r.food || r.amt.trim()).map((r): [string, number] => [r.food, parseNum(r.amt)]),
    };
    this.busy.set(true);
    try {
      const saved = id ? await this.catalog.update(id, meal) : await this.catalog.add(meal);
      if (!saved) {
        this.toast.show(t(id ? 'references.mealLastOfPool' : 'references.mealInvalid'));
        return;
      }
      this.editingId.set(null);
      this.draft.set(blank(d.slot));
      this.toast.show(t(id ? 'references.mealUpdated' : 'references.mealAdded'));
      this.list.reload();
    } catch (e) {
      this.toast.show(t(e instanceof AuthError && e.code === 'forbidden' ? 'references.mealForbidden' : 'references.saveFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(e: MealEntry): Promise<void> {
    if (!(await this.confirm.ask(t('references.deleteMeal', { name: e.name }), { confirmLabel: t('common.delete'), danger: true }))) return;
    try {
      if (!(await this.catalog.remove(e.id))) {
        this.toast.show(t('references.mealLastOfPool'));
        return;
      }
      if (this.editingId() === e.id) this.cancelEdit();
      this.toast.show(t('references.mealDeleted'));
      this.list.reload();
    } catch (err) {
      this.toast.show(t(err instanceof AuthError && err.code === 'forbidden' ? 'references.mealForbidden' : 'references.saveFailed'));
    }
  }
}
