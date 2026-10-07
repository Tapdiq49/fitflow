import { HttpHeaders } from '@angular/common/http';
import { foodsPageParse, foodsPageRequest } from './supabase-food.repository';

const BASE = 'https://example.supabase.co';
const DB_ROW = { id: 'a', code: 'egg', names: { az: 'Yumurta' }, unit: 'piece', kcal: '78', protein: '6.3', carbs: '0.6', fat: '5.3', role: 'protein', step: '1', min_amount: '1', max_amount: '4' };

describe('foods page request', () => {
  it('asks for one page, system foods first, and for the total count', () => {
    const req = foodsPageRequest(BASE, { page: 3, pageSize: 50, search: '' });
    expect(req.url).toBe(`${BASE}/rest/v1/foods`);
    expect(req.params).toMatchObject({ limit: '50', offset: '100', order: 'user_id.asc.nullsfirst,names->>az.asc,id.asc' });
    expect(req.params).not.toHaveProperty('or');
    expect(req.headers).toEqual({ Prefer: 'count=exact' });
  });

  it('searches the name in every language', () => {
    const req = foodsPageRequest(BASE, { page: 1, pageSize: 10, search: 'toyuq' });
    expect((req.params as Record<string, string>)['or']).toBe('(names->>az.ilike.*toyuq*,names->>en.ilike.*toyuq*,names->>ru.ilike.*toyuq*)');
  });

  it('drops characters that would change the meaning of the filter', () => {
    const req = foodsPageRequest(BASE, { page: 1, pageSize: 10, search: 'a%b_c*d,e(f)g"h\\i' });
    expect((req.params as Record<string, string>)['or']).toContain('*a b c d e f g h i*');
  });
});

describe('foods page response', () => {
  it('reads the rows and the total from Content-Range', () => {
    const page = foodsPageParse([DB_ROW], new HttpHeaders({ 'Content-Range': '0-0/37' }));
    expect(page.total).toBe(37);
    expect(page.rows).toEqual([
      { id: 'a', code: 'egg', names: { az: 'Yumurta' }, unit: 'ədəd', k: 78, p: 6.3, c: 0.6, f: 5.3, role: 'protein', step: 1, min: 1, max: 4 },
    ]);
  });

  it('reads an empty answer, and leaves the total open when the header is missing', () => {
    expect(foodsPageParse([], new HttpHeaders({ 'Content-Range': '*/0' }))).toEqual({ rows: [], total: 0 });
    expect(foodsPageParse([DB_ROW], undefined).total).toBeNull();
    expect(foodsPageParse('not rows', undefined)).toEqual({ rows: [], total: null });
  });
});
