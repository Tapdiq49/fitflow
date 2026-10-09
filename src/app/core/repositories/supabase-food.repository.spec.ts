import { HttpHeaders } from '@angular/common/http';
import { foodsPageParse, foodsPageRequest } from './supabase-food.repository';

const BASE = 'https://example.supabase.co';
const DB_ROW = { id: 'a', code: 'egg', n_az: 'Yumurta', n_en: 'Egg', unit: 'piece', kcal: '78', protein: '6.3', carbs: '0.6', fat: '5.3', role: 'protein', step: '1', min_amount: '1', max_amount: '4', position: null };

describe('foods page request', () => {
  it('asks for one page, system foods first, and for the total count', () => {
    const req = foodsPageRequest(BASE, { page: 3, pageSize: 50, search: '' }, 'az');
    expect(req.url).toBe(`${BASE}/rest/v1/food_list`);
    expect(req.params).toMatchObject({ limit: '50', offset: '100', order: 'position.asc.nullslast,user_id.asc.nullsfirst,names->>az.asc,id.asc' });
    expect(req.headers).toEqual({ Prefer: 'count=exact' });
  });

  it('asks for the name in one language only (Azerbaijani comes along as the fallback), ordered by it', () => {
    const az = foodsPageRequest(BASE, { page: 1, pageSize: 10, search: '' }, 'az').params as Record<string, string>;
    expect(az['select']).toContain('n_az:names->>az');
    expect(az['select']).not.toContain('n_en');
    const en = foodsPageRequest(BASE, { page: 1, pageSize: 10, search: '' }, 'en').params as Record<string, string>;
    expect(en['select']).toContain('n_az:names->>az, n_en:names->>en');
    expect(en['select']).not.toContain('n_ru');
    expect(en['order']).toContain('names->>en.asc');
  });

  it('searches the name in the asked language only', () => {
    const params = foodsPageRequest(BASE, { page: 1, pageSize: 10, search: 'toyuq' }, 'ru').params as Record<string, string>;
    expect(params['names->>ru']).toBe('ilike.*toyuq*');
    expect(params).not.toHaveProperty('or');
    expect(params).not.toHaveProperty('names->>az');
  });

  it('drops characters that would change the meaning of the filter', () => {
    const params = foodsPageRequest(BASE, { page: 1, pageSize: 10, search: 'a%b_c*d,e(f)g"h\\i' }, 'az').params as Record<string, string>;
    expect(params['names->>az']).toContain('*a b c d e f g h i*');
  });
});

describe('foods page response', () => {
  it('reads the rows and the total from Content-Range', () => {
    const page = foodsPageParse([DB_ROW], new HttpHeaders({ 'Content-Range': '0-0/37' }));
    expect(page.total).toBe(37);
    expect(page.rows).toEqual([
      { id: 'a', code: 'egg', names: { az: 'Yumurta', en: 'Egg' }, unit: 'ədəd', k: 78, p: 6.3, c: 0.6, f: 5.3, role: 'protein', step: 1, min: 1, max: 4, position: null },
    ]);
  });

  it('reads an empty answer, and leaves the total open when the header is missing', () => {
    expect(foodsPageParse([], new HttpHeaders({ 'Content-Range': '*/0' }))).toEqual({ rows: [], total: 0 });
    expect(foodsPageParse([DB_ROW], undefined).total).toBeNull();
    expect(foodsPageParse('not rows', undefined)).toEqual({ rows: [], total: null });
  });
});
