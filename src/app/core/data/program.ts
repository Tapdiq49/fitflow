import { DayType, Exercise, Variant } from '../models';

export const EXERCISES: Record<string, Exercise> = {
  legpress: { name: 'Leg Press', sets: 3, min: 8, max: 12, kind: 'lower', inc: 5, incEarly: 5, note: 'İtələyərkən nəfəs ver, nəfəsi saxlama. Dizləri tam kilidləmə.' },
  bench: { name: 'Bench Press', sets: 3, min: 8, max: 10, kind: 'upper', inc: 2.5, note: 'Kürək bıçaqlarını yığ, çubuğu idarəli endir.' },
  latpd: { name: 'Lat Pulldown', sets: 3, min: 8, max: 12, kind: 'upper', inc: 2.5, note: 'Dirsəkləri aşağı-arxaya çək, bədəni yelləmə.' },
  rdl: { name: 'Romanian Deadlift', sets: 2, min: 8, max: 10, kind: 'lower', inc: 5, incEarly: 2.5, note: 'Yüngül-orta çəki, bel düz. Valsalva (nəfəs tutma) etmə.' },
  dbpress: { name: 'Dumbbell Shoulder Press', sets: 2, min: 8, max: 12, kind: 'upper', inc: 2, note: 'Çəki hər hantel üçündür. Oturaraq, bel dəstəkli.' },
  curl: { name: 'Biceps Curl', sets: 2, min: 10, max: 12, kind: 'upper', inc: 1, note: 'Dirsəkləri sabit saxla.' },
  pushdown: { name: 'Triceps Pushdown', sets: 2, min: 10, max: 12, kind: 'upper', inc: 2.5, note: 'Aşağıda 1 saniyə saxla.' },
  crunch: { name: 'Cable Crunch', sets: 3, min: 12, max: 15, kind: 'upper', inc: 2.5, note: 'Orta çəki. Qarın təzyiqini kəskin artırma; diskomfort olarsa dayan.' },
  squat: { name: 'Squat / Leg Press', sets: 3, min: 8, max: 10, kind: 'lower', inc: 5, incEarly: 2.5, note: 'Əməliyyatdan sonra ilk 6–8 həftə Leg Press seçmək daha təhlükəsizdir.' },
  incline: { name: 'Incline Dumbbell Press', sets: 3, min: 8, max: 12, kind: 'upper', inc: 2, note: 'Çəki hər hantel üçündür. 30° bucaq.' },
  row: { name: 'Seated Cable Row', sets: 3, min: 8, max: 12, kind: 'upper', inc: 2.5, note: 'Sinəni dik saxla, kürəkləri sıx.' },
  legcurl: { name: 'Leg Curl', sets: 3, min: 10, max: 15, kind: 'lower', inc: 2.5, note: 'Yavaş eniş (2–3 san).' },
  lateral: { name: 'Lateral Raise', sets: 3, min: 12, max: 15, kind: 'upper', inc: 1, note: 'Yüngül çəki, çiyin hündürlüyünə qədər.' },
  hammer: { name: 'Hammer Curl', sets: 2, min: 10, max: 12, kind: 'upper', inc: 1, note: 'Neytral tutuş.' },
  ohtri: { name: 'Overhead Triceps Extension', sets: 2, min: 10, max: 12, kind: 'upper', inc: 2.5, note: 'Dirsəkləri dar saxla.' },
  plank: { name: 'Plank', sets: 3, min: 30, max: 60, kind: 'time', inc: 5, note: 'Normal nəfəs al, nəfəsi saxlama. Təkrar = saniyə.' },
};

export const PROGRAM: Record<Variant, string[]> = {
  A: ['legpress', 'bench', 'latpd', 'rdl', 'dbpress', 'curl', 'pushdown', 'crunch'],
  B: ['squat', 'incline', 'row', 'legcurl', 'lateral', 'hammer', 'ohtri', 'plank'],
};

/** Heavy compounds get a longer rest timer. */
export const HEAVY_LIFTS = new Set(['legpress', 'squat', 'bench', 'rdl']);

export const SAFETY = [
  'Ağır setlərdə nəfəsi saxlama (Valsalva) — qaldırarkən nəfəs ver.',
  'Qasıq/xaya nahiyəsində ağrı, şişkinlik və ya ağırlıq hissi olarsa məşqi dayandır və uroloqa müraciət et.',
  'İlk həftələrdə maksimal çəkilərdən, ağır squat və deadlift-dən qaç; Leg Press və trenajorlara üstünlük ver.',
  'Dəstəkləyici (sıx) idman alt paltarı rahatlıq verə bilər.',
  'Ağır yüklənməyə keçməzdən əvvəl həkiminlə razılaşdır. Bu proqram tibbi məsləhət deyil.',
];

export const TIPS: Record<DayType | 'general', string[]> = {
  training: [
    'Məşqdən 60–90 dəqiqə əvvəl az yağlı və az lifli yemək ye — həm enerji verir, həm də köpü azaldır.',
    'Hər hərəkətdə 1–3 təkrar ehtiyat saxla. Natural əzələ artımı üçün uğursuzluğa (failure) qədər getmək lazım deyil.',
    'Bu gün progressive overload günüdür: keçən dəfəki rəqəmləri ən azı 1 təkrar və ya kiçik çəki ilə keç.',
    'Məşqdən sonrakı yeməkdə 40–50 q protein və yaxşı karbohidrat (düyü/kartof) al.',
    'Setlər arası 90–150 saniyə istirahət et. Ağır hərəkətlərdə 2–3 dəqiqə.',
  ],
  cardio: [
    'Kardionu danışa biləcəyin tempdə et (Zona 2, ~110–135 vurğu/dəq). Məqsəd ürək sağlamlığıdır, əzələni yandırmaq yox.',
    'Kardio 30 dəqiqədən çox olmasın — əsas məqsəd əzələ yığmaqdır.',
    'Bu gün də protein hədəfini tamamla — əzələ bərpası davam edir.',
    'Yeməkdən sonra 10–15 dəqiqə yerimək həzmə və köpün azalmasına kömək edir.',
  ],
  rest: [
    'Əzələ məhz bərpa günlərində böyüyür. Bu gün yuxuya xüsusi diqqət et: 7–9 saat.',
    'İstirahət günü də protein hədəfi eynidir — 170–190 q.',
    'Yüngül gəzinti (6–8 min addım) və 10 dəqiqə stretching bərpanı sürətləndirir.',
    'Həftəni yekunlaşdır: çəki ortalaması, bel ölçüsü, məşq rəqəmləri — trend vacibdir, bir günlük rəqəm yox.',
  ],
  general: [
    'Yeməkləri yavaş ye və yaxşı çeynə — köpü azaltmağın ən sadə yolu budur.',
    'Qazlı içkiləri, saqqızı və yemək zamanı çox su içməyi azalt.',
    'Suyu gün boyu bölərək iç — bir dəfəyə çox içmə.',
    'Yatmazdan 2–3 saat əvvəl ağır yemək yemə; yüngül protein (kəsmik/qatıq) olar.',
  ],
};
