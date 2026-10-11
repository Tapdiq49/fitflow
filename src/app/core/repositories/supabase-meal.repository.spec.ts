import { HttpHeaders } from '@angular/common/http';
import { mealsPageParse, mealsPageRequest } from './supabase-meal.repository';

const BASE = 'https://example.supabase.co';
const DB_ROW = { id: 'a', code: 'b1', slot: 'breakfast', position: 1, main: 'egg', light: false, items: [['oats', 80]], n_az: 'Yulaf', n_en: 'Oats' };

describe('meals page request', () => {
  it('asks for one page in the order of the day, and for the total count', () => {
    const req = mealsPageRequest(BASE, { page: 3, pageSize: 10, search: '' }, 'az', null);
    expect(req.url).toBe(`${BASE}/rest/v1/meal_templates`);
    expect(req.params).toMatchObject({ limit: '10', offset: '20', order: 'slot_rank.asc,position.asc,code.asc' });
    expect(req.params as Record<string, string>).not.toHaveProperty('slot');
    expect(req.headers).toEqual({ Prefer: 'count=exact' });
  });

  it('limits the list to one pool', () => {
    const params = mealsPageRequest(BASE, { page: 1, pageSize: 10, search: '' }, 'az', 'lunch').params as Record<string, string>;
    expect(params['slot']).toBe('eq.lunch');
  });

  it('asks for the name in one language only (Azerbaijani comes along as the fallback)', () => {
    const az = mealsPageRequest(BASE, { page: 1, pageSize: 10, search: '' }, 'az', null).params as Record<string, string>;
    expect(az['select']).toContain('n_az:names->>az');
    expect(az['select']).not.toContain('n_en');
    const ru = mealsPageRequest(BASE, { page: 1, pageSize: 10, search: '' }, 'ru', null).params as Record<string, string>;
    expect(ru['select']).toContain('n_az:names->>az, n_ru:names->>ru');
    expect(ru['select']).not.toContain('n_en');
  });

  it('searches the name in the asked language only, without characters that change the filter', () => {
    const params = mealsPageRequest(BASE, { page: 1, pageSize: 10, search: 'to%yu_q' }, 'en', null).params as Record<string, string>;
    expect(params['names->>en']).toBe('ilike.*to yu q*');
    expect(params).not.toHaveProperty('names->>az');
  });
});

describe('meals page response', () => {
  it('reads the rows and the total from Content-Range', () => {
    const page = mealsPageParse([DB_ROW], new HttpHeaders({ 'Content-Range': '0-0/37' }));
    expect(page.total).toBe(37);
    expect(page.rows).toEqual([{ id: 'a', code: 'b1', slot: 'breakfast', position: 1, names: { az: 'Yulaf', en: 'Oats' }, main: 'egg', light: false, items: [['oats', 80]] }]);
  });

  it('reads an empty answer, and leaves the total open when the header is missing', () => {
    expect(mealsPageParse([], new HttpHeaders({ 'Content-Range': '*/0' }))).toEqual({ rows: [], total: 0 });
    expect(mealsPageParse([DB_ROW], undefined).total).toBeNull();
    expect(mealsPageParse('not rows', undefined)).toEqual({ rows: [], total: null });
  });
});
