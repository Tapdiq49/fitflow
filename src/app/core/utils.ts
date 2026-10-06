import { signal } from '@angular/core';
import { Lang } from './models';

/** Active UI language. I18nService keeps it in sync with the settings; read it inside templates/computeds to stay reactive. */
export const activeLang = signal<Lang>('az');

interface Names {
  days: string[];
  short: string[];
  months: string[];
  /** Month names as used inside a full date ("6 октября 2026"). */
  monthsOf: string[];
  monthsShort: string[];
  /** Hour / minute unit letters for durations. */
  h: string;
  m: string;
}

const NAMES: Record<Lang, Names> = {
  az: {
    days: ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'],
    short: ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'],
    months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'],
    monthsOf: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'],
    monthsShort: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'],
    h: 's',
    m: 'd',
  },
  en: {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    short: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsOf: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    h: 'h',
    m: 'm',
  },
  ru: {
    days: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
    short: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    monthsOf: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    monthsShort: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    h: 'ч',
    m: 'м',
  },
};

/** Weekday name for index 0 = Monday. */
export const dayName = (i: number): string => NAMES[activeLang()].days[i];
export const dayShort = (i: number): string => NAMES[activeLang()].short[i];
/** Month name for index 0 = January (standalone form, e.g. a calendar title). */
export const monthName = (i: number): string => NAMES[activeLang()].months[i];
export const weekdaysShort = (): string[] => NAMES[activeLang()].short;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date helpers working on local "YYYY-MM-DD" keys. Day of week: 1 = Monday … 7 = Sunday. */
export const DateU = {
  key: (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  today: (): string => DateU.key(new Date()),
  parse: (k: string): Date => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  add: (k: string, n: number): string => {
    const d = DateU.parse(k);
    d.setDate(d.getDate() + n);
    return DateU.key(d);
  },
  dow: (k: string): number => {
    const g = DateU.parse(k).getDay();
    return g === 0 ? 7 : g;
  },
  monday: (k: string): string => DateU.add(k, 1 - DateU.dow(k)),
  diffDays: (a: string, b: string): number => Math.round((DateU.parse(b).getTime() - DateU.parse(a).getTime()) / 86_400_000),
  long: (k: string): string => {
    const d = DateU.parse(k);
    return `${d.getDate()} ${NAMES[activeLang()].monthsOf[d.getMonth()]} ${d.getFullYear()}, ${dayName(DateU.dow(k) - 1)}`;
  },
  short: (k: string): string => {
    const d = DateU.parse(k);
    return `${d.getDate()} ${NAMES[activeLang()].monthsShort[d.getMonth()]}`;
  },
};

export const rnd = (n: number, d = 0): number => {
  const m = 10 ** d;
  return Math.round(n * m) / m;
};
export const clamp = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, n));
export const uid = (): string => Math.random().toString(36).slice(2, 10);
export const pct = (a: number, b: number): number => (b > 0 ? clamp(Math.round((a / b) * 100), 0, 100) : 0);
export const hashStr = (s: string): number => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
};
export const toMin = (hm: string): number => {
  if (!hm) return 0;
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (m: number): string => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`;
};
export const nowHM = (): string => {
  const d = new Date();
  return fromMin(d.getHours() * 60 + d.getMinutes());
};
/** Parses user input, accepting a comma as decimal separator. Returns NaN when invalid. */
export const parseNum = (v: string | number | null | undefined): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
export const inputValue = (e: Event): string => (e.target as HTMLInputElement).value;

/** Formatting helpers exposed to templates. */
export const F = {
  round: (n: number): number => Math.round(n),
  r1: (n: number): number => rnd(n, 1),
  kg: (n: number | null | undefined): string => (n == null || Number.isNaN(n) ? '—' : String(rnd(n, 1))),
  signed: (n: number, d = 1): string => (n > 0 ? '+' : '') + rnd(n, d),
  pct,
  liters: (ml: number): number => rnd(ml / 1000, 2),
  dur: (m: number | null): string => (m == null ? '—' : `${Math.floor(m / 60)}${NAMES[activeLang()].h} ${pad(m % 60)}${NAMES[activeLang()].m}`),
  long: DateU.long,
  short: DateU.short,
};
