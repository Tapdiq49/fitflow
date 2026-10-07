import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Directive, TemplateRef, computed, contentChildren, inject, input } from '@angular/core';

export interface TableColumn<T> {
  id: string;
  /** Already translated; leave empty for a column without a title (row actions). */
  header: string;
  /** Text of the cell. Leave out when a `appTableCell` template with this column's id is given. */
  value?: (row: T) => string | number;
  /** Extra classes for the header and the cells, e.g. `tbl-text`, `tbl-num` (right-aligned numbers) or `text-right`. */
  class?: string;
}

/** Marks a template as the content of one column's cell: `<ng-template appTableCell="actions" let-row>…</ng-template>`. */
@Directive({ selector: 'ng-template[appTableCell]' })
export class TableCellDirective {
  readonly id = input.required<string>({ alias: 'appTableCell' });
  readonly template = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}

/**
 * A plain table on the app's `.tbl` look: columns described as data, rows from the owner, a message when there are none.
 * Paging, searching and sorting stay with the owner (see `PagedQuery` and `<app-pagination>`).
 *
 * ```html
 * <app-data-table [columns]="columns()" [rows]="rows()" [rowKey]="rowKey" [emptyText]="'x.nothing' | t">
 *   <ng-template appTableCell="actions" let-row><button (click)="remove(row)">…</button></ng-template>
 * </app-data-table>
 * ```
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <div class="overflow-x-auto" style="border: 0">
        <table class="tbl">
          <thead>
            <tr>
              @for (c of columns(); track c.id) {
                <th [class]="c.class ?? ''">{{ c.header }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track rowKey()(row)) {
              <tr>
                @for (c of columns(); track c.id) {
                  <td [class]="c.class ?? ''">
                    @if (cells().get(c.id); as cell) {
                      <ng-container *ngTemplateOutlet="cell; context: { $implicit: row }" />
                    } @else if (c.value) {
                      {{ c.value(row) }}
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="empty">{{ emptyText() }}</div>
    }
  `,
})
export class DataTableComponent<T> {
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  /** A stable key per row, so a changed list keeps the rows that stay. */
  readonly rowKey = input.required<(row: T) => string | number>();
  /** Shown instead of the table when there are no rows (already translated). */
  readonly emptyText = input('');

  private readonly cellTemplates = contentChildren(TableCellDirective);
  protected readonly cells = computed(() => new Map(this.cellTemplates().map((c) => [c.id(), c.template])));
}
