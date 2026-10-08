import az from './az.json';
import en from './en.json';
import ru from './ru.json';
import adminAz from './admin.az.json';
import adminEn from './admin.en.json';
import adminRu from './admin.ru.json';
import planAz from './plan.az.json';
import planEn from './plan.en.json';
import planRu from './plan.ru.json';
import suppAz from './supp.az.json';
import suppEn from './supp.en.json';
import suppRu from './supp.ru.json';
import { PERMISSIONS } from '../../common/interfaces';
import { activeLang } from '../utils';
import { t, td } from './translate';

const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
const AZ = az as Record<string, string>;
const EN = en as Record<string, string>;
const RU = ru as Record<string, string>;

describe('translations', () => {
  afterEach(() => activeLang.set('az'));

  it('has every key in all three languages', () => {
    const keys = Object.keys(AZ).sort();
    expect(Object.keys(EN).sort()).toEqual(keys);
    expect(Object.keys(RU).sort()).toEqual(keys);
  });

  it('has every key of each text pack in all three languages, with the same placeholders, and none of them in the main files', () => {
    const packs: Record<string, [Record<string, string>, Record<string, string>, Record<string, string>]> = {
      admin: [adminAz, adminEn, adminRu],
      plan: [planAz, planEn, planRu],
      supp: [suppAz, suppEn, suppRu],
    };
    for (const [name, [pAz, pEn, pRu]] of Object.entries(packs)) {
      const keys = Object.keys(pAz).sort();
      expect(Object.keys(pEn).sort(), `${name} en`).toEqual(keys);
      expect(Object.keys(pRu).sort(), `${name} ru`).toEqual(keys);
      for (const key of keys) {
        expect(AZ[key], `${name} pack key ${key} is also in az.json`).toBeUndefined();
        expect(placeholders(pEn[key]), `${name} en ${key}`).toEqual(placeholders(pAz[key]));
        expect(placeholders(pRu[key]), `${name} ru ${key}`).toEqual(placeholders(pAz[key]));
      }
    }
  });

  it('has a text for every permission and module in the admin pack', () => {
    const pack = adminAz as Record<string, string>;
    for (const id of PERMISSIONS) {
      expect(pack['perm.' + id], id).toBeTruthy();
      expect(pack['perm.module.' + id.slice(0, id.indexOf('.'))], id).toBeTruthy();
    }
  });

  it('keeps the same {placeholders} in every language', () => {
    for (const key of Object.keys(AZ)) {
      expect(placeholders(EN[key]), `en ${key}`).toEqual(placeholders(AZ[key]));
      expect(placeholders(RU[key]), `ru ${key}`).toEqual(placeholders(AZ[key]));
    }
  });

  it('has no empty translations', () => {
    for (const dict of [EN, RU]) for (const [key, text] of Object.entries(dict)) expect(text.trim(), key).not.toBe('');
  });

  it('translates by key, fills placeholders and falls back to the key', () => {
    expect(t('app.today')).toBe('Bugün');
    activeLang.set('en');
    expect(t('app.today')).toBe('Today');
    expect(t('day.waterNL', { v: 1.5 })).toBe('Water: 1.5 L');
    activeLang.set('ru');
    expect(t('day.waterNL', { v: 1.5 })).toBe('Вода: 1.5 л');
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('translates built-in content text and leaves unknown text unchanged', () => {
    expect(td('Yumurta')).toBe('Yumurta');
    activeLang.set('en');
    expect(td('Yumurta')).toBe('Egg');
    activeLang.set('ru');
    expect(td('Səhər yeməyi')).toBe('Завтрак');
    expect(td('custom user text')).toBe('custom user text');
  });
});
