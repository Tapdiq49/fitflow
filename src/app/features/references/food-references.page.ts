import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { Lang, Unit } from '../../common/interfaces';
import { ConfirmService } from '../../core/services/confirm.service';
import { MIN_SEARCH_LENGTH, Page, PagedQuery, pageSlice, pagedResource } from '../../core/paging';
import { FoodRepository, FoodRow } from '../../core/repositories/food.repository';
import { FoodCatalogService, FoodEntry, foodEntryOf } from '../../core/services/food-catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { F, inputValue, parseNum } from '../../core/utils';
import { SelectComponent, SelectOption } from '../../shared/forms/select.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { TableCellDirective } from '../../common/directives/table-cell/table-cell.directive';
import { DataTableComponent, TableColumn, TableMove } from '../../shared/table/data-table.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { t, td } from '../../core/i18n/translate';

const BLANK = { az: '', en: '', ru: '', unit: 'q' as Unit, k: '', p: '', c: '', f: '' };
type Draft = typeof BLANK;
type TextField = Exclude<keyof Draft, 'unit'>;

/** The food database reference list: system foods (locked) and the user's own (they can be changed and deleted); every food can be put in the order the user likes. Opened from the reference index. */
@Component({
  selector: 'app-food-references-page',
  imports: [RouterLink, DataTableComponent, IconComponent, PaginationComponent, SelectComponent, TableCellDirective, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div><a routerLink="/references" class="btn btn-ghost btn-sm"><app-icon name="left" size="sm" />{{ 'nav.references' | t }}</a></div>

      @if (auth.user()) {
      <div class="card" #form>
        <div class="card-head"><h3><app-icon [name]="editingId() ? 'edit' : 'plus'" /> {{ (editingId() ? 'references.editFood' : 'references.addFood') | t }}</h3></div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-start gap-3 [&_[role=combobox]]:h-[42px] [&_input]:h-[42px]">
          <label class="field">{{ 'references.nameAz' | t }}<input type="text" [value]="draft().az" (input)="set('az', $event)" (keydown.enter)="save()" /></label>
          <label class="field">{{ 'references.nameEn' | t }}<input type="text" [value]="draft().en" (input)="set('en', $event)" (keydown.enter)="save()" /></label>
          <label class="field">{{ 'references.nameRu' | t }}<input type="text" [value]="draft().ru" (input)="set('ru', $event)" (keydown.enter)="save()" /></label>
          <div class="field">{{ 'references.unit' | t }}<app-select [label]="'references.unit' | t" [options]="unitOptions()" [value]="draft().unit" (valueChange)="setUnit($event)" /></div>
        </div>
        <div class="mt-3 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] items-start gap-3 [&_input]:h-[42px]">
          <label class="field">{{ 'addMeal.kcal' | t }}<input type="text" inputmode="decimal" [value]="draft().k" (input)="set('k', $event)" (keydown.enter)="save()" /></label>
          <label class="field">{{ 'dash.protein' | t }}<input type="text" inputmode="decimal" [value]="draft().p" (input)="set('p', $event)" (keydown.enter)="save()" /></label>
          <label class="field">{{ 'dash.carbs' | t }}<input type="text" inputmode="decimal" [value]="draft().c" (input)="set('c', $event)" (keydown.enter)="save()" /></label>
          <label class="field">{{ 'dash.fat' | t }}<input type="text" inputmode="decimal" [value]="draft().f" (input)="set('f', $event)" (keydown.enter)="save()" /></label>
        </div>
        <p class="text-muted" style="font-size: 12px; margin: 10px 0 0">{{ 'references.macrosPer' | t: { a: perLabel() } }}</p>
        <div class="mt-3"><button class="btn btn-primary" [disabled]="busy()" (click)="save()">@if (busy()) { <span class="spinner"></span> } @else { <app-icon [name]="editingId() ? 'save' : 'plus'" size="sm" /> }{{ (editingId() ? 'common.save' : 'references.add') | t }}</button>@if (editingId()) { <button class="btn" style="margin-left: 8px" [disabled]="busy()" (click)="cancelEdit()">{{ 'common.cancel' | t }}</button> }</div>
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
          <span class="badge">{{ total() }}</span>
        </div>
        <p class="text-muted" style="font-size: 12px; margin: 0 0 12px">{{ 'references.foodsHint' | t }}</p>
        @if (catalog.loadFailed()) {
          <div class="alert alert-warn mb-3" role="status"><app-icon name="alert" /><div>{{ 'references.loadFailed' | t }}</div></div>
        }
        <input type="text" class="w-full" [value]="q.searchInput()" (input)="q.setSearch(val($event))" [placeholder]="'references.search' | t" [attr.aria-label]="'references.search' | t" />
        <p class="text-muted mb-3" style="font-size: 12px; margin: 6px 0 0">@if (searchTooShort()) { {{ 'references.searchMin' | t: { n: minSearch } }} }</p>
        <app-data-table [columns]="columns()" [rows]="view().rows" [rowKey]="rowKey" [emptyText]="'references.nothingFound' | t" [loading]="catalog.loading() || list.loading()" [loadingLabel]="'common.loading' | t" [reorderable]="!!auth.user()" [reorderLabel]="'references.drag' | t" (reorder)="reorder($event)">
          <ng-template appTableCell="actions" let-e>
            @if (e.isSystem) {
              <span class="badge" [title]="'references.systemLocked' | t"><app-icon name="lock" size="sm" />{{ 'references.system' | t }}</span>
            } @else {
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
  /** Id of the own food being changed in the form; null = the form adds a new one. */
  protected readonly editingId = signal<string | null>(null);
  private readonly form = viewChild<ElementRef<HTMLElement>>('form');
  protected readonly unitOptions = computed<SelectOption<Unit>[]>(() => (['q', 'ədəd', 'ölçü'] as const).map((u) => ({ value: u, label: td(u) })));
  protected readonly perLabel = computed(() => (this.draft().unit === 'q' ? `100 ${td('q')}` : `1 ${td(this.draft().unit)}`));

  protected set(field: TextField, e: Event): void {
    const value = inputValue(e);
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected setUnit(unit: Unit): void {
    this.draft.update((d) => ({ ...d, unit }));
  }

  /** Fills the form with one of the user's own foods, to change it. */
  protected edit(e: FoodEntry): void {
    const row = this.catalog.own(e.id);
    if (!row) return;
    const text = (n: number): string => String(n);
    this.draft.set({ az: row.names.az ?? '', en: row.names.en ?? '', ru: row.names.ru ?? '', unit: row.unit, k: text(row.k), p: text(row.p), c: text(row.c), f: text(row.f) });
    this.editingId.set(e.id);
    this.form()?.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.draft.set({ ...BLANK, unit: this.draft().unit });
  }

  /** The form adds a new food, or saves the changes of the one being edited. */
  protected async save(): Promise<void> {
    if (this.busy()) return;
    const d = this.draft();
    const id = this.editingId();
    const food = { names: { az: d.az, en: d.en, ru: d.ru } as Partial<Record<Lang, string>>, unit: d.unit, k: parseNum(d.k), p: parseNum(d.p), c: parseNum(d.c), f: parseNum(d.f) };
    this.busy.set(true);
    try {
      const saved = id ? await this.catalog.update(id, food) : await this.catalog.add(food);
      if (!saved) {
        this.toast.show(t('references.enterFoodName'));
        return;
      }
      this.editingId.set(null);
      this.draft.set({ ...BLANK, unit: d.unit });
      this.toast.show(t(id ? 'references.foodUpdated' : 'references.foodAdded'));
      this.list.reload();
    } catch {
      this.toast.show(t('references.saveFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  /** A row was dragged (or moved with the arrow keys) inside the page: the food takes the place of the one it was dropped on, in the user's own order. */
  protected async reorder(move: TableMove): Promise<void> {
    const rows = this.view().rows;
    const moved = rows[move.from]?.rowId;
    const target = rows[move.to]?.rowId;
    // Only a page that came from the backend can be reordered (not the built-in fallback list).
    const server = this.list.view();
    if (!moved || !target || moved === target || !server || this.list.failed() || this.list.idle()) return;
    // Show the new order at once; the backend confirms below.
    this.list.patch((page) => {
      const next = [...page.rows];
      next.splice(move.to, 0, ...next.splice(move.from, 1));
      return { ...page, rows: next };
    });
    try {
      await this.catalog.move(moved, target);
    } catch {
      this.toast.show(t('references.saveFailed'));
      this.list.reload();
    }
  }

  protected async remove(e: FoodEntry): Promise<void> {
    if (!(await this.confirm.ask(t('references.deleteFood', { name: e.name }), { confirmLabel: t('common.delete'), danger: true }))) return;
    try {
      if (await this.catalog.remove(e.id)) {
        if (this.editingId() === e.id) this.cancelEdit();
        this.toast.show(t('references.foodDeleted'));
        this.list.reload();
      }
    } catch {
      this.toast.show(t('references.saveFailed'));
    }
  }
}
