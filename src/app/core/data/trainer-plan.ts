import { MealItem, SlotId, TrainerMeal, WeekPlan } from '../models';

/** Trainer exercise ids start with this prefix so they never clash with the built-in program's ids. */
export const TRAINER_EX_PREFIX = 't:';
export const trainerExId = (name: string): string => TRAINER_EX_PREFIX + name.trim().toLowerCase().replace(/\s+/g, ' ');

/** The trainer's slots in day order with their default times. */
export const TRAINER_SLOTS: ReadonlyArray<{ slot: SlotId; time: string }> = [
  { slot: 'breakfast', time: '08:00' },
  { slot: 'snack', time: '11:00' },
  { slot: 'lunch', time: '14:00' },
  { slot: 'snack2', time: '16:00' },
  { slot: 'dinner', time: '19:30' },
];

/** Trainer plan day n = weekday n (1 = Monday), matching the Mon/Wed/Fri gym schedule. Dinner is eaten at 19:30, not 17:30–18:00. */
export const TRAINER_DINNER_TIME = '19:30';

// Macros are rough estimates per listed portion (X/Q = xörək qaşığı); the trainer gave none.
const it = (name: string, amtLabel: string, k: number, p: number, c: number, f: number): MealItem => ({ amt: 1, name, amtLabel, k, p, c, f });

const EGG = it('Soyutma yumurta', '1 ədəd', 78, 6.3, 0.6, 5.3);
const CHICKEN = it('Toyuq filesi', '100 q', 165, 31, 0, 3.6);
const CUCUMBER = it('Xiyar', '2 ədəd', 30, 1.3, 5.5, 0.3);
const PARSLEY = it('Petruşka', 'yarım dəstə', 5, 0.4, 0.8, 0.1);
const APPLE = it('Yaşıl alma', '1 ədəd', 80, 0.4, 21, 0.3);
const ALMOND = it('Badam', '4 ədəd', 28, 1, 1, 2.5);
const BUCKWHEAT = it('Qreçka', '4 X/Q', 55, 2, 12, 0.4);
const CARROT = it('Kök', '1 ədəd', 33, 0.7, 7.7, 0.2);
const MEAT = it('Soyutma toyuq və ya mal əti', '150 q', 248, 46.5, 0, 5.4);
const GREEN_TEA = it('Yaşıl çay', '1 stəkan', 2, 0, 0.3, 0);
const COFFEE = it('Şəkərsiz qəhvə', '1 stəkan', 2, 0.3, 0, 0);
const DATE1 = it('İran xurması', '1 ədəd', 33, 0.3, 9, 0);
const DATE2 = it('İran xurması', '2 ədəd', 66, 0.6, 18, 0);
const APRICOT = it('Ərik qurusu', '1 ədəd', 19, 0.2, 5, 0);
const AYRAN = it('Ayran', '1 stəkan', 60, 3.4, 4.5, 3);
const YOGURT4 = it('Qatıq', '4 X/Q', 36, 2, 2.7, 1.5);
const COTTAGE = it('Pəhriz kəsmiyi', '2 X/Q', 44, 6.8, 1.2, 1.4);
const DIET_SALAD = it('Diet salatı', '1 porsiya', 60, 2, 8, 2);

const b = (items: MealItem[], name: string): TrainerMeal => ({ slot: 'breakfast', time: '08:00', name, items });
const s1 = (items: MealItem[], name: string): TrainerMeal => ({ slot: 'snack', time: '11:00', name, items });
const l = (items: MealItem[], name: string): TrainerMeal => ({ slot: 'lunch', time: '14:00', name, items });
const s2 = (items: MealItem[], name: string): TrainerMeal => ({ slot: 'snack2', time: '16:00', name, items });
const d = (items: MealItem[], name: string): TrainerMeal => ({ slot: 'dinner', time: TRAINER_DINNER_TIME, name, items });

const dogramac = d([YOGURT4, CUCUMBER, PARSLEY], 'Doğramac (qatıq + xiyar + petruşka)');
const buckwheatLunch = l([BUCKWHEAT, CHICKEN, CUCUMBER, PARSLEY], 'Qreçka + toyuq filesi + xiyar + petruşka');
const meatDinner = d([MEAT, CUCUMBER], 'Soyutma toyuq və ya mal əti + xiyar');
const coffeeApricot = (slot: typeof s1) => slot([COFFEE, APRICOT], 'Şəkərsiz qəhvə + ərik qurusu');

/** First week's plan; used until the user writes one of their own. */
export const TRAINER_PLAN: WeekPlan = {
  1: [
    b([EGG, CUCUMBER, PARSLEY], 'Soyutma yumurta + xiyar + petruşka'),
    s1([APPLE], 'Yaşıl alma'),
    buckwheatLunch,
    s2([CARROT, ALMOND], 'Kök + badam'),
    meatDinner,
  ],
  2: [
    b([GREEN_TEA, DATE1, ALMOND], 'Yaşıl çay + iran xurması + badam'),
    s1([APPLE], 'Yaşıl alma'),
    l([DIET_SALAD, AYRAN], 'Diet salatı + ayran'),
    coffeeApricot(s2),
    dogramac,
  ],
  3: [
    b([EGG, CUCUMBER, PARSLEY], 'Yumurta + xiyar + petruşka'),
    coffeeApricot(s1),
    buckwheatLunch,
    s2([ALMOND], 'Badam'),
    d(
      [
        it('Tvorkadan keçirilmiş çuğundur', '1 ədəd', 43, 1.6, 10, 0.2),
        it('Əzilmiş sarımsaq', '1 ədəd', 4, 0.2, 0.9, 0),
        it('Əzilmiş qoz', '2 ədəd', 52, 1.2, 1.1, 5.2),
        it('Qatıq', '2 X/Q', 18, 1, 1.4, 0.8),
      ],
      'Çuğundur salatı',
    ),
  ],
  4: [
    b([COFFEE, COTTAGE, DATE1], 'Şəkərsiz qəhvə + pəhriz kəsmiyi + iran xurması'),
    s1([ALMOND], 'Badam'),
    l([DIET_SALAD], 'Diet salatı'),
    s2([CARROT], 'Kök'),
    dogramac,
  ],
  5: [
    b([GREEN_TEA, DATE2], 'Yaşıl çay + iran xurması'),
    s1([APPLE, ALMOND], 'Yaşıl alma + badam'),
    l([it('Kükü (2 yumurta, bol göyərti)', '1 porsiya', 165, 13.5, 2, 11), CUCUMBER, AYRAN], 'Kükü + xiyar + ayran'),
    coffeeApricot(s2),
    dogramac,
  ],
  6: [
    b([GREEN_TEA, DATE1, COTTAGE], 'Yaşıl çay + iran xurması + pəhriz kəsmiyi'),
    coffeeApricot(s1),
    l([it('Tərəvəz supu', '1 kasa', 80, 3, 12, 2)], 'Tərəvəz supu'),
    s2([ALMOND], 'Badam'),
    d([it('Çoban salatı (xiyar, pomidor, göyərti, kök, soğan, limon)', '1 porsiya', 70, 2, 14, 0.5)], 'Çoban salatı'),
  ],
  7: [
    b([GREEN_TEA, DATE1, COTTAGE], 'Yaşıl çay + iran xurması + pəhriz kəsmiyi'),
    s1([APPLE], 'Yaşıl alma'),
    buckwheatLunch,
    coffeeApricot(s2),
    meatDinner,
  ],
};
