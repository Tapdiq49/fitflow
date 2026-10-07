import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataTableComponent, TableCellDirective, TableColumn } from './data-table.component';

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
