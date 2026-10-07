import { PAGE_SIZES, PagedQuery, lastPageOf, pageSlice } from './paging';

describe('PagedQuery', () => {
  it('starts on page 1 with 10 rows per page; the sizes on offer are 10, 50 and 100', () => {
    const q = new PagedQuery();
    expect(q.params()).toEqual({ page: 1, pageSize: 10, search: '' });
    expect([...PAGE_SIZES]).toEqual([10, 50, 100]);
  });

  it('sends the search only from 3 characters on (spaces around do not count)', () => {
    const q = new PagedQuery();
    q.setSearch('to');
    expect(q.params().search).toBe('');
    q.setSearch('  toy ');
    expect(q.params().search).toBe('toy');
    expect(q.searchInput()).toBe('  toy '); // the input keeps what was typed
  });

  it('goes back to page 1 when the effective search or the page size changes, not when the page does', () => {
    const q = new PagedQuery();
    q.setSearch('toy');
    q.setPage(4);
    expect(q.page()).toBe(4);

    q.setSearch('toyu'); // a new search
    expect(q.page()).toBe(1);

    q.setPage(3);
    q.setSearch('to'); // too short: the sent search becomes empty, which is a change
    expect(q.page()).toBe(1);
    q.setPage(3);
    q.setSearch('t'); // still empty: nothing changes
    expect(q.page()).toBe(3);

    q.setPageSize(50);
    expect(q.page()).toBe(1);
    expect(q.pageSize()).toBe(50);
    q.setPage(2);
    q.setPageSize(50); // same size: stays
    expect(q.page()).toBe(2);
  });

  it('never goes below page 1, and falls back to the last page when the current one disappears', () => {
    const q = new PagedQuery();
    q.setPage(0);
    expect(q.page()).toBe(1);
    q.setPage(5);
    q.clampTo(23); // 3 pages of 10
    expect(q.page()).toBe(3);
    q.clampTo(0);
    expect(q.page()).toBe(1);
  });
});

describe('paging helpers', () => {
  it('counts pages', () => {
    expect(lastPageOf(0, 10)).toBe(1);
    expect(lastPageOf(10, 10)).toBe(1);
    expect(lastPageOf(11, 10)).toBe(2);
    expect(lastPageOf(100, 50)).toBe(2);
  });

  it('cuts a page out of a list, filtering by the search first', () => {
    const all = Array.from({ length: 25 }, (_, i) => `item ${i + 1}`);
    expect(pageSlice(all, { page: 1, pageSize: 10, search: '' }, (x) => x)).toEqual({ rows: all.slice(0, 10), total: 25 });
    expect(pageSlice(all, { page: 3, pageSize: 10, search: '' }, (x) => x).rows).toHaveLength(5);
    const found = pageSlice(all, { page: 1, pageSize: 10, search: 'ITEM 2' }, (x) => x); // case does not matter
    expect(found.total).toBe(7); // item 2, 20–25
    expect(found.rows).toHaveLength(7);
  });
});
