import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PAGE_SIZES, lastPageOf } from '../../core/paging';
import { t } from '../../core/i18n/translate';
import { SelectComponent, SelectOption } from '../forms/select.component';
import { IconComponent } from '../icon/icon.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';

/**
 * Footer of a paged table: rows per page, "1–10 / 37", previous / next. It only shows and reports; the owner of the data
 * (a `PagedQuery`) applies the changes.
 *
 * ```html
 * <app-pagination [page]="q.page()" [pageSize]="q.pageSize()" [total]="total" (pageChange)="q.setPage($event)" (pageSizeChange)="q.setPageSize($event)" />
 * ```
 */
@Component({
  selector: 'app-pagination',
  imports: [SelectComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.8125rem]">
      <label class="flex items-center gap-2 text-muted">
        {{ 'pagination.perPage' | t }}
        <app-select class="w-[5.5rem] [&_[role=combobox]]:h-9" [label]="'pagination.perPage' | t" [options]="sizeOptions()" [value]="pageSize()" (valueChange)="pageSizeChange.emit($event)" />
      </label>
      <span class="text-muted">{{ range() }}</span>
      <div class="flex items-center gap-1.5">
        <button class="btn btn-sm btn-icon" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)" [attr.aria-label]="'pagination.previous' | t"><app-icon name="left" size="sm" /></button>
        <span class="px-1.5 font-semibold whitespace-nowrap">{{ 'pagination.page' | t: { page: page(), pages: pages() } }}</span>
        <button class="btn btn-sm btn-icon" [disabled]="page() >= pages()" (click)="pageChange.emit(page() + 1)" [attr.aria-label]="'pagination.next' | t"><app-icon name="right" size="sm" /></button>
      </div>
    </div>
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  /** Rows in all pages. */
  readonly total = input.required<number>();
  readonly pageSizes = input<readonly number[]>(PAGE_SIZES);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pages = computed(() => lastPageOf(this.total(), this.pageSize()));
  protected readonly sizeOptions = computed<SelectOption<number>[]>(() => this.pageSizes().map((n) => ({ value: n, label: String(n) })));
  protected readonly range = computed(() => {
    const total = this.total();
    if (!total) return '0';
    const from = (this.page() - 1) * this.pageSize() + 1;
    return t('pagination.range', { from, to: Math.min(total, from + this.pageSize() - 1), total });
  });
}
