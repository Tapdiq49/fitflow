import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { Unit } from '../../core/models';
import { ConfirmService } from '../../core/services/confirm.service';
import { MIN_SEARCH_LENGTH, Page, PagedQuery, pageSlice, pagedResource } from '../../core/paging';
import { FoodRepository, FoodRow } from '../../core/repositories/food.repository';
import { FoodCatalogService, FoodEntry, foodEntryOf } from '../../core/services/food-catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { F, inputValue, parseNum } from '../../core/utils';
import { SelectComponent, SelectOption } from '../../shared/forms/select.component';
import { IconComponent } from '../../shared/icon.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { DataTableComponent, TableCellDirective, TableColumn } from '../../shared/table/data-table.component';
import { TPipe } from '../../shared/t.pipe';
import { t, td } from '../../core/i18n/translate';

const BLANK = { az: '', en: '', ru: '', unit: 'q' as Unit, k: '', p: '', c: '', f: '' };
type Draft = typeof BLANK;
type TextField = Exclude<keyof Draft, 'unit'>;

/** The food database reference list: system foods (locked) and the user's own (deletable). Opened from the reference index. */
@Component({
  selector: 'app-food-references-page',
  imports: [RouterLink, DataTableComponent, IconComponent, PaginationComponent, SelectComponent, TableCellDirective, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div><a routerLink="/references" class="btn btn-ghost btn-sm"><app-icon name="left" size="sm" />{{ 'nav.references' | t }}</a></div>

      @if (auth.user()) {
      <div class="card">
        <div class="card-head"><h3><app-icon name="plus" /> {{ 'references.addFood' | t }}</h3></div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-start gap-3 [&_[role=combobox]]:h-[42px] [&_input]:h-[42px]">
          <label class="field">{{ 'references.nameAz' | t }}<input type="text" [value]="draft().az" (input)="set('az', $event)" (keydown.enter)="add()" /></label>
          <label class="field">{{ 'references.nameEn' | t }}<input type="text" [value]="draft().en" (input)="set('en', $event)" (keydown.enter)="add()" /></label>
          <label class="field">{{ 'references.nameRu' | t }}<input type="text" [value]="draft().ru" (input)="set('ru', $event)" (keydown.enter)="add()" /></label>
          <div class="field">{{ 'references.unit' | t }}<app-select [label]="'references.unit' | t" [options]="unitOptions()" [value]="draft().unit" (valueChange)="setUnit($event)" /></div>
        </div>
        <div class="mt-3 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] items-start gap-3 [&_input]:h-[42px]">
          <label class="field">{{ 'addMeal.kcal' | t }}<input type="text" inputmode="decimal" [value]="draft().k" (input)="set('k', $event)" (keydown.enter)="add()" /></label>
          <label class="field">{{ 'dash.protein' | t }}<input type="text" inputmode="decimal" [value]="draft().p" (input)="set('p', $event)" (keydown.enter)="add()" /></label>
          <label class="field">{{ 'dash.carbs' | t }}<input type="text" inputmode="decimal" [value]="draft().c" (input)="set('c', $event)" (keydown.enter)="add()" /></label>
          <label class="field">{{ 'dash.fat' | t }}<input type="text" inputmode="decimal" [value]="draft().f" (input)="set('f', $event)" (keydown.enter)="add()" /></label>
        </div>
        <p class="text-muted" style="font-size: 12px; margin: 10px 0 0">{{ 'references.macrosPer' | t: { a: perLabel() } }}</p>
        <div class="mt-3"><button class="btn btn-primary" [disabled]="busy()" (click)="add()">@if (busy()) { <span class="spinner"></span> } @else { <app-icon name="plus" size="sm" /> }{{ 'references.add' | t }}</button></div>
      </div>
      } @else if (auth.isGuest()) {
        <div class="alert alert-info">
          <app-icon name="info" />
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>{{ 'references.guestHint' | t }}</span>
            <a class="btn btn-sm btn-primary" routerLink="/auth/sign-in">{{ 'auth.signIn' | t }}</a>
          </div>
        </div>
      }

      <div class="card">
        <div class="card-head">
          <h3><app-icon name="utensils" /> {{ 'references.foods' | t }}</h3>
          @if (catalog.loading() || list.loading()) { <span class="spinner text-muted" aria-hidden="true"></span> }
          <span class="badge">{{ total() }}</span>
        </div>
        <p class="text-muted" style="font-size: 12px; margin: 0 0 12px">{{ 'references.foodsHint' | t }}</p>
        @if (catalog.loadFailed()) {
          <div class="alert alert-warn mb-3" role="status"><app-icon name="alert" /><div>{{ 'references.loadFailed' | t }}</div></div>
        }
        <input type="text" class="w-full" [value]="q.searchInput()" (input)="q.setSearch(val($event))" [placeholder]="'references.search' | t" [attr.aria-label]="'references.search' | t" />
        <p class="text-muted mb-3" style="font-size: 12px; margin: 6px 0 0">@if (searchTooShort()) { {{ 'references.searchMin' | t: { n: minSearch } }} }</p>
        <app-data-table [columns]="columns()" [rows]="view().rows" [rowKey]="rowKey" [emptyText]="'references.nothingFound' | t">
          <ng-template appTableCell="actions" let-e>
            @if (e.isSystem) {
              <span class="badge" [title]="'references.systemLocked' | t"><app-icon name="lock" size="sm" />{{ 'references.system' | t }}</span>
            } @else {
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
export class FoodReferencesPage {
  protected readonly val = inputValue;

  protected readonly catalog = inject(FoodCatalogService);
  protected readonly auth = inject(AuthStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);

  /** Page, page size and search; the backend answers each combination and a new one cancels the request still running. */
  protected readonly q = new PagedQuery();
  protected readonly minSearch = MIN_SEARCH_LENGTH;
  protected readonly searchTooShort = computed(() => {
    const n = this.q.searchInput().trim().length;
    return n > 0 && n < MIN_SEARCH_LENGTH;
  });

  private readonly repo = inject(FoodRepository);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  protected readonly list = pagedResource<FoodRow>(this.q, {
    // Reading userId here makes signing in or out a new request (the signed-in user also gets their own foods).
    request: (p) => {
      this.userId();
      return this.repo.request(p);
    },
    parse: (body, headers, p) => this.repo.parse(body, headers, p),
  });

  /** The backend page; the same page cut from the built-in / saved list while the backend cannot be reached. */
  protected readonly view = computed<Page<FoodEntry>>(() => {
    const server = this.list.view();
    if (server && !this.list.failed() && !this.list.idle()) return { rows: server.rows.map(foodEntryOf), total: server.total };
    return pageSlice(this.catalog.entries(), this.q.params(), (e) => e.name);
  });
  protected readonly total = computed(() => this.view().total ?? this.view().rows.length);

  protected readonly rowKey = (e: FoodEntry): string => e.id;
  protected readonly columns = computed<TableColumn<FoodEntry>[]>(() => [
    { id: 'name', header: t('common.food'), class: 'tbl-text', value: (e) => e.name },
    { id: 'unit', header: t('references.unit'), value: (e) => td(e.unit) },
    { id: 'k', header: t('addMeal.kcal'), class: 'tbl-num', value: (e) => F.round(e.k) },
    { id: 'p', header: t('dash.protein'), class: 'tbl-num', value: (e) => e.p },
    { id: 'c', header: t('dash.carbs'), class: 'tbl-num', value: (e) => e.c },
    { id: 'f', header: t('dash.fat'), class: 'tbl-num', value: (e) => e.f },
    { id: 'actions', header: '', class: 'text-right' },
  ]);

  constructor() {
    // A page that no longer exists (rows deleted, a shorter list) goes back to the last one.
    effect(() => {
      const total = this.total();
      untracked(() => this.q.clampTo(total));
    });
  }

  protected readonly draft = signal<Draft>({ ...BLANK });
  protected readonly unitOptions = computed<SelectOption<Unit>[]>(() => (['q', 'ədəd', 'ölçü'] as const).map((u) => ({ value: u, label: td(u) })));
  protected readonly perLabel = computed(() => (this.draft().unit === 'q' ? `100 ${td('q')}` : `1 ${td(this.draft().unit)}`));

  protected set(field: TextField, e: Event): void {
    const value = inputValue(e);
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected setUnit(unit: Unit): void {
    this.draft.update((d) => ({ ...d, unit }));
  }

  protected async add(): Promise<void> {
    if (this.busy()) return;
    const d = this.draft();
    this.busy.set(true);
    try {
      const added = await this.catalog.add({ names: { az: d.az, en: d.en, ru: d.ru }, unit: d.unit, k: parseNum(d.k), p: parseNum(d.p), c: parseNum(d.c), f: parseNum(d.f) });
      if (!added) {
        this.toast.show(t('references.enterFoodName'));
        return;
      }
      this.draft.set({ ...BLANK, unit: d.unit });
      this.toast.show(t('references.foodAdded'));
      this.list.reload();
    } catch {
      this.toast.show(t('references.saveFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(e: FoodEntry): Promise<void> {
    if (!(await this.confirm.ask(t('references.deleteFood', { name: e.name }), { confirmLabel: t('common.delete'), danger: true }))) return;
    try {
      if (await this.catalog.remove(e.id)) {
        this.toast.show(t('references.foodDeleted'));
        this.list.reload();
      }
    } catch {
      this.toast.show(t('references.saveFailed'));
    }
  }
}
