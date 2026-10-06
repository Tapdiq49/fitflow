import az from './az.json';
import en from './en.json';
import ru from './ru.json';
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
