import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, Directive, TemplateRef, computed, contentChildren, inject, input, output } from '@angular/core';
import { IconComponent } from '../icon.component';

export interface TableColumn<T> {
  id: string;
  /** Already translated; leave empty for a column without a title (row actions). */
  header: string;
  /** Text of the cell. Leave out when a `appTableCell` template with this column's id is given. */
  value?: (row: T) => string | number;
  /** Extra classes for the header and the cells, e.g. `tbl-text`, `tbl-num` (right-aligned numbers) or `text-right`. */
  class?: string;
}

/** A row dragged (or moved with the arrow keys) from one index of `rows` to another. */
export interface TableMove {
  from: number;
  to: number;
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
 * With `reorderable` a grip appears in front of the rows that `canDrag` allows. A row is dragged with the mouse or touch,
 * or moved with ↑ / ↓ while its grip has the focus. The table only reports the move (`reorder`); the owner decides, saves
 * it and hands back the rows in the new order.
 *
 * ```html
 * <app-data-table [columns]="columns()" [rows]="rows()" [rowKey]="rowKey" [emptyText]="'x.nothing' | t">
 *   <ng-template appTableCell="actions" let-row><button (click)="remove(row)">…</button></ng-template>
 * </app-data-table>
 * ```
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, CdkDropList, CdkDrag, CdkDragHandle, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [attr.aria-busy]="loading()">
    @if (rows().length) {
      <div class="overflow-x-auto" style="border: 0">
        <table class="tbl">
          <thead>
            <tr>
              @if (reorderable()) {
                <th class="w-8"></th>
              }
              @for (c of columns(); track c.id) {
                <th [class]="c.class ?? ''">{{ c.header }}</th>
              }
            </tr>
          </thead>
          <tbody cdkDropList [cdkDropListDisabled]="!reorderable()" [cdkDropListSortPredicate]="sortPredicate" (cdkDropListDropped)="dropped($event)">
            @for (row of rows(); track rowKey()(row); let i = $index) {
              <tr cdkDrag [cdkDragDisabled]="!draggable(row)" cdkDragPreviewClass="tbl-drag-preview" cdkDragPreviewContainer="parent" (cdkDragEnded)="unfreeze($event.source.element.nativeElement)">
                @if (reorderable()) {
                  <td class="w-8">
                    @if (canDrag()(row)) {
                      <button type="button" cdkDragHandle class="drag-handle" [attr.aria-label]="reorderLabel()" [title]="reorderLabel()" (keydown)="handleKey($event, i)" (pointerdown)="freeze($event)" (pointerup)="unfreeze(rowOf($event))">
                        <app-icon name="grip" size="sm" />
                      </button>
                    }
                  </td>
                }
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
    @if (loading()) {
      <div class="absolute inset-0 grid place-items-center rounded-lg bg-[color-mix(in_srgb,var(--surface)_60%,transparent)]" role="status" [attr.aria-label]="loadingLabel()"><span class="spinner text-muted"></span></div>
    }
    </div>
  `,
})
export class DataTableComponent<T> {
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  /** A stable key per row, so a changed list keeps the rows that stay. */
  readonly rowKey = input.required<(row: T) => string | number>();
  /** Shown instead of the table when there are no rows (already translated). */
  readonly emptyText = input('');

  /** Rows are being read: a spinner covers the table. */
  readonly loading = input(false);
  /** Accessible name of the spinner (already translated). */
  readonly loadingLabel = input('');

  /** Rows can be moved. */
  readonly reorderable = input(false);
  /** Which rows have a grip (and may be dropped on); the others stay where they are. */
  readonly canDrag = input<(row: T) => boolean>(() => true);
  /** Accessible name of the grip (already translated). */
  readonly reorderLabel = input('');
  /** A row moved from one index of `rows` to another. */
  readonly reorder = output<TableMove>();

  private readonly cellTemplates = contentChildren(TableCellDirective);
  protected readonly cells = computed(() => new Map(this.cellTemplates().map((c) => [c.id(), c.template])));

  protected draggable(row: T): boolean {
    return this.reorderable() && this.canDrag()(row);
  }

  /** A row may not be sorted into the place of a row that is not movable. */
  protected readonly sortPredicate = (index: number): boolean => {
    const row = this.rows()[index];
    return row === undefined || this.canDrag()(row);
  };

  private static readonly CELL_STYLE = ['width', 'min-width', 'max-width', 'box-sizing'] as const;

  protected rowOf(e: Event): HTMLTableRowElement {
    return (e.currentTarget as HTMLElement).closest('tr') as HTMLTableRowElement;
  }

  /**
   * The drag preview is a copy of the row. Its cells must keep the width they have in the table, so they are pinned
   * before the copy is made (a copy lives outside the column layout) and released when the drag is over.
   */
  protected freeze(e: Event): void {
    const row = this.rowOf(e);
    const widths = Array.from(row.cells, (c) => c.getBoundingClientRect().width);
    Array.from(row.cells).forEach((c, i) => {
      c.style.boxSizing = 'border-box';
      c.style.width = c.style.minWidth = c.style.maxWidth = `${widths[i]}px`;
    });
  }

  protected unfreeze(row: HTMLTableRowElement | HTMLElement | null): void {
    if (!row) return;
    for (const c of Array.from((row as HTMLTableRowElement).cells)) for (const p of DataTableComponent.CELL_STYLE) c.style.removeProperty(p);
  }

  protected dropped(e: CdkDragDrop<unknown>): void {
    if (e.previousIndex !== e.currentIndex) this.reorder.emit({ from: e.previousIndex, to: e.currentIndex });
  }

  protected handleKey(e: KeyboardEvent, index: number): void {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
    if (to === null) return;
    e.preventDefault();
    const target = this.rows()[to];
    if (target !== undefined && this.canDrag()(target)) this.reorder.emit({ from: index, to });
  }
}
