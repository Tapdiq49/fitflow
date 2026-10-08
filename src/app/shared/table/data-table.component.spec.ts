import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TableCellDirective } from '../../common/directives/table-cell/table-cell.directive';
import { DataTableComponent, TableColumn } from './data-table.component';

interface Row {
  id: number;
  name: string;
  kcal: number;
}

@Component({
  imports: [DataTableComponent, TableCellDirective],
  template: `
    <app-data-table [columns]="columns" [rows]="rows()" [rowKey]="rowKey" emptyText="Nothing here">
      <ng-template appTableCell="actions" let-row><button type="button">delete {{ row.name }}</button></ng-template>
    </app-data-table>
  `,
})
class Host {
  readonly rows = signal<Row[]>([
    { id: 1, name: 'Egg', kcal: 78 },
    { id: 2, name: 'Rice', kcal: 130 },
  ]);
  readonly columns: TableColumn<Row>[] = [
    { id: 'name', header: 'Food', class: 'tbl-text', value: (r) => r.name },
    { id: 'kcal', header: 'kcal', class: 'tbl-num', value: (r) => r.kcal },
    { id: 'actions', header: '' },
  ];
  readonly rowKey = (r: Row): number => r.id;
}

describe('DataTableComponent', () => {
  const render = async (): Promise<{ root: HTMLElement; host: Host; settle: () => Promise<void> }> => {
    const fixture = TestBed.createComponent(Host);
    const settle = async (): Promise<void> => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    await settle();
    return { root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance, settle };
  };

  it('draws a header and one row per item, with the column classes', async () => {
    const { root } = await render();
    expect(Array.from(root.querySelectorAll('th')).map((th) => th.textContent!.trim())).toEqual(['Food', 'kcal', '']);
    expect(root.querySelector('th.tbl-num')).not.toBeNull();
    const rows = Array.from(root.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('td.tbl-text')!.textContent!.trim()).toBe('Egg');
    expect(rows[1].querySelector('td.tbl-num')!.textContent!.trim()).toBe('130');
  });

  it('renders a projected template in the cell of its column, with the row', async () => {
    const { root } = await render();
    const buttons = Array.from(root.querySelectorAll('tbody button'));
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['delete Egg', 'delete Rice']);
  });

  it('shows the empty message instead of the table when there are no rows, and follows changes', async () => {
    const { root, host, settle } = await render();
    host.rows.set([]);
    await settle();
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('.empty')!.textContent).toContain('Nothing here');
    host.rows.set([{ id: 3, name: 'Milk', kcal: 52 }]);
    await settle();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});

@Component({
  imports: [DataTableComponent],
  template: `
    <app-data-table [columns]="columns" [rows]="rows" [rowKey]="rowKey" [reorderable]="true" [canDrag]="canDrag" reorderLabel="Move" (reorder)="moves.push($event)" />
  `,
})
class ReorderHost {
  readonly moves: { from: number; to: number }[] = [];
  readonly rows: Row[] = [
    { id: 1, name: 'System', kcal: 1 },
    { id: 2, name: 'Mine A', kcal: 2 },
    { id: 3, name: 'Mine B', kcal: 3 },
  ];
  readonly columns: TableColumn<Row>[] = [{ id: 'name', header: 'Food', value: (r) => r.name }];
  readonly rowKey = (r: Row): number => r.id;
  readonly canDrag = (r: Row): boolean => r.id !== 1; // the first row is fixed
}

describe('DataTableComponent reordering', () => {
  const render = async (): Promise<{ root: HTMLElement; host: ReorderHost }> => {
    const fixture = TestBed.createComponent(ReorderHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  };
  const key = (button: Element, name: string): void => {
    button.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  };

  it('shows a grip only on the rows that can be moved', async () => {
    const { root } = await render();
    const rows = Array.from(root.querySelectorAll('tbody tr'));
    expect(rows.map((r) => r.querySelector('button.drag-handle') !== null)).toEqual([false, true, true]);
    expect(root.querySelector('button.drag-handle')!.getAttribute('aria-label')).toBe('Move');
  });

  it('moves a row with the arrow keys, but not onto a fixed row or past the ends', async () => {
    const { root, host } = await render();
    const grips = Array.from(root.querySelectorAll('button.drag-handle'));
    key(grips[1], 'ArrowDown'); // Mine B (index 2) cannot go further down
    key(grips[0], 'ArrowUp'); // Mine A (index 1) cannot go onto the fixed row at index 0
    expect(host.moves).toEqual([]);

    key(grips[0], 'ArrowDown'); // Mine A -> index 2
    key(grips[1], 'ArrowUp'); // Mine B -> index 1
    key(grips[0], 'Enter'); // other keys are ignored
    expect(host.moves).toEqual([{ from: 1, to: 2 }, { from: 2, to: 1 }]);
  });
});
