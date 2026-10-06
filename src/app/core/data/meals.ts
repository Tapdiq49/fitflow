import { MealTemplate, SlotId, TemplateKey } from '../models';

export const SLOTS: Record<SlotId, { label: string; pool?: TemplateKey }> = {
  breakfast: { label: 'Səhər yeməyi' },
  snack: { label: 'Ara yemək' },
  lunch: { label: 'Nahar' },
  snack2: { label: 'Günorta ara yeməyi', pool: 'snack' },
  pre: { label: 'Məşqdən əvvəl' },
  post: { label: 'Məşqdən sonra' },
  dinner: { label: 'Axşam yeməyi' },
  supp: { label: 'Supplement' },
  custom: { label: 'Əlavə yemək' },
};

export const TEMPLATES: Record<TemplateKey, MealTemplate[]> = {
  breakfast: [
    { id: 'b1', name: 'Yulaf sıyığı + yumurta + banan', main: 'egg', items: [['oats', 80], ['banana', 1], ['walnut', 10], ['egg', 3]] },
    { id: 'b2', name: 'Omlet + tam taxıl çörək + salat', main: 'egg', items: [['egg', 3], ['eggwhite', 3], ['bread', 80], ['salad', 150], ['cheese', 20]] },
    { id: 'b3', name: 'Kəsmik kasası (yulaf + giləmeyvə + bal)', main: 'cottage', items: [['cottage', 200], ['oats', 60], ['berries', 100], ['honey', 10]] },
    { id: 'b4', name: 'Qarabaşaq + qaynadılmış yumurta', main: 'egg', items: [['buckwheat', 200], ['egg', 3], ['eggwhite', 2], ['salad', 100]] },
    { id: 'b5', name: 'Toyuqlu lavaş dürmək + yumurta', main: 'chicken', items: [['lavash', 70], ['chicken', 100], ['egg', 2], ['salad', 100]] },
    { id: 'b6', name: 'Overnight oats (qatıq + kəsmik)', main: 'cottage', items: [['oats', 70], ['yogurt', 200], ['cottage', 100], ['banana', 1], ['almond', 10]] },
  ],
  snack: [
    { id: 's1', name: 'Kəsmik + kivi', items: [['cottage', 200], ['kiwi', 2]] },
    { id: 's2', name: 'Qatıq + badam + banan', items: [['yogurt', 250], ['almond', 15], ['banana', 1]] },
    { id: 's3', name: 'Tuna sendviç', items: [['bread', 60], ['tuna', 100], ['salad', 80]] },
    { id: 's4', name: 'Kefir + qoz + portağal', items: [['kefir', 300], ['walnut', 15], ['orange', 1]] },
    { id: 's5', name: 'Qaynadılmış yumurta + çörək + portağal', items: [['egg', 2], ['eggwhite', 2], ['bread', 50], ['orange', 1]] },
    { id: 's6', name: 'Mini toyuq + düyü', items: [['chicken', 120], ['rice', 150], ['salad', 80]] },
  ],
  lunch: [
    { id: 'l1', name: 'Toyuq döşü + düyü + salat', main: 'chicken', items: [['chicken', 200], ['rice', 250], ['salad', 150], ['oil', 10]] },
    { id: 'l2', name: 'Mal əti + kartof + salat', main: 'beef', items: [['beef', 170], ['potato', 300], ['salad', 150], ['oil', 5]] },
    { id: 'l3', name: 'Balıq + düyü + bişmiş tərəvəz', main: 'fish', items: [['fish', 250], ['rice', 250], ['vegs', 150], ['oil', 10]] },
    { id: 'l4', name: 'Toyuq + qarabaşaq + salat', main: 'chicken', items: [['chicken', 200], ['buckwheat', 250], ['salad', 150], ['oil', 10]] },
    { id: 'l5', name: 'Mal əti + bulqur plov + salat', main: 'beef', items: [['beef', 170], ['bulgur', 250], ['salad', 150], ['oil', 5]] },
    { id: 'l6', name: 'Toyuq budu + makaron + tərəvəz', main: 'thigh', items: [['thigh', 180], ['pasta', 200], ['vegs', 150]] },
    { id: 'l7', name: 'Tunalı makaron + salat', main: 'tuna', items: [['tuna', 150], ['pasta', 220], ['salad', 150], ['oil', 10]] },
    { id: 'l8', name: 'Sobada toyuq + kartof + tərəvəz', main: 'chicken', items: [['chicken', 200], ['potato', 350], ['vegs', 150], ['oil', 5]] },
  ],
  pre: [
    { id: 'p1', name: 'Banan + qatıq + bal', items: [['banana', 1], ['yogurt', 200], ['honey', 10]] },
    { id: 'p2', name: 'Yüngül düyü + toyuq', items: [['rice', 150], ['chicken', 100]] },
    { id: 'p3', name: 'Çörək + bal + kəsmik', items: [['bread', 60], ['honey', 15], ['cottage', 100]] },
    { id: 'p4', name: 'Suda yulaf + banan', items: [['oats', 50], ['banana', 1]] },
    { id: 'p5', name: 'Xurma + kefir', items: [['dates', 40], ['kefir', 250]] },
  ],
  post: [
    { id: 'pw1', name: 'Toyuq + düyü + salat', main: 'chicken', items: [['chicken', 180], ['rice', 250], ['salad', 100]] },
    { id: 'pw2', name: 'Balıq + kartof + salat', main: 'fish', items: [['fish', 220], ['potato', 300], ['salad', 100]] },
    { id: 'pw3', name: 'Mal əti + düyü + tərəvəz', main: 'beef', items: [['beef', 160], ['rice', 220], ['vegs', 100]] },
    { id: 'pw4', name: 'Omlet + çörək + banan', main: 'egg', items: [['egg', 2], ['eggwhite', 4], ['bread', 80], ['banana', 1]] },
    { id: 'pw5', name: 'Toyuq + qarabaşaq + salat', main: 'chicken', items: [['chicken', 180], ['buckwheat', 250], ['salad', 100]] },
  ],
  dinner: [
    { id: 'd1', name: 'Kəsmik + qoz + giləmeyvə', light: true, main: 'cottage', items: [['cottage', 250], ['walnut', 15], ['berries', 100]] },
    { id: 'd2', name: 'Balıq + kartof + salat', main: 'fish', items: [['fish', 220], ['potato', 250], ['salad', 150], ['oil', 5]] },
    { id: 'd3', name: 'Yumurta + salat + çörək', light: true, main: 'egg', items: [['egg', 3], ['eggwhite', 2], ['salad', 200], ['bread', 50]] },
    { id: 'd4', name: 'Toyuq + bişmiş tərəvəz + qarabaşaq', main: 'chicken', items: [['chicken', 180], ['vegs', 200], ['buckwheat', 150], ['oil', 5]] },
    { id: 'd5', name: 'Qatıq + kəsmik + kivi', light: true, main: 'cottage', items: [['yogurt', 200], ['cottage', 150], ['kiwi', 1]] },
    { id: 'd6', name: 'Mal əti + bulqur + salat', main: 'beef', items: [['beef', 150], ['bulgur', 150], ['salad', 150], ['oil', 5]] },
    { id: 'd7', name: 'Tuna salatı + kartof', light: true, main: 'tuna', items: [['tuna', 120], ['potato', 200], ['salad', 200], ['oil', 5]] },
  ],
};
