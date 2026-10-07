import { HttpHeaders, HttpResourceRequest, httpResource } from '@angular/common/http';
import { effect, signal, computed, untracked } from '@angular/core';

/** Page sizes offered to the user. */
export const PAGE_SIZES = [10, 50, 100] as const;
/** A search text shorter than this is not sent to the backend. */
export const MIN_SEARCH_LENGTH = 3;

export interface PageParams {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Already checked: empty, or at least MIN_SEARCH_LENGTH characters. */
  search: string;
}

export interface Page<T> {
  rows: T[];
  /** Number of rows in all pages; null when the backend did not say. */
  total: number | null;
}

export const lastPageOf = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / pageSize));

/** Page, page size and search of a paged table. A change of page size or of the effective search goes back to page 1. */
export class PagedQuery {
  readonly page = signal(1);
  readonly pageSize = signal<number>(PAGE_SIZES[0]);
  /** What the user typed. */
  readonly searchInput = signal('');
  /** What is sent: the typed text from MIN_SEARCH_LENGTH characters on, otherwise nothing. */
  readonly search = computed(() => {
    const text = this.searchInput().trim();
    return text.length >= MIN_SEARCH_LENGTH ? text : '';
  });
  readonly params = computed<PageParams>(() => ({ page: this.page(), pageSize: this.pageSize(), search: this.search() }));

  setSearch(text: string): void {
    const before = this.search();
    this.searchInput.set(text);
    if (this.search() !== before) this.page.set(1);
  }

  setPageSize(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(1);
  }

  setPage(page: number): void {
    this.page.set(Math.max(1, Math.floor(page)));
  }

  /** After rows were deleted the current page may not exist any more. */
  clampTo(total: number): void {
    const last = lastPageOf(total, this.pageSize());
    if (this.page() > last) this.page.set(last);
  }
}

/** The same paging done in memory (when the backend cannot be reached): search in `text`, then one page of the matches. */
export function pageSlice<T>(all: readonly T[], p: PageParams, text: (row: T) => string): Page<T> {
  const needle = p.search.toLowerCase();
  const matches = needle ? all.filter((row) => text(row).toLowerCase().includes(needle)) : all;
  const start = (p.page - 1) * p.pageSize;
  return { rows: matches.slice(start, start + p.pageSize), total: matches.length };
}

/** How a backend turns page parameters into an HTTP request and its response back into a page. */
export interface PageSource<T> {
  /** Undefined = nothing to ask (backend not configured). */
  request(p: PageParams): HttpResourceRequest | undefined;
  parse(body: unknown, headers: HttpHeaders | undefined, p: PageParams): Page<T>;
}

/**
 * A page of rows read through `httpResource`: a new page, size or search starts a new request and the one still running
 * is cancelled by Angular, so typing letters one after another never leaves old answers behind.
 * The last page that arrived stays in `view` while the next one loads. Call it where `inject` works (a field initializer).
 */
export function pagedResource<T>(query: PagedQuery, source: PageSource<T>) {
  const res = httpResource<unknown>(() => source.request(query.params()));
  const last = signal<Page<T> | null>(null);

  effect(() => {
    if (!res.hasValue()) return;
    const page = source.parse(res.value(), res.headers(), untracked(query.params));
    last.set(page);
    if (page.total !== null) untracked(() => query.clampTo(page.total as number));
  });

  return {
    /** The last page that arrived, null until the first one. */
    view: last.asReadonly(),
    loading: res.isLoading,
    /** The request failed (offline, server error). */
    failed: computed(() => res.error() !== undefined),
    /** Nothing is asked at all (backend not configured). */
    idle: computed(() => res.status() === 'idle'),
    reload: (): boolean => res.reload(),
    /** Changes the page that is shown (an order the user just dragged), before the backend has confirmed it. */
    patch: (change: (page: Page<T>) => Page<T>): void => last.update((page) => (page ? change(page) : page)),
  };
}
