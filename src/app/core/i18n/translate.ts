import { activeLang } from '../utils';
import az from './az.json';

/**
 * Translation files (az/en/ru.json): one flat map of named keys ("settings.profileAndTargets") to texts.
 * Azerbaijani is the source language. Keys with a content prefix (food., meal., tip., …) hold the built-in content
 * texts that the code and saved menus keep as plain Azerbaijani; `td` finds their key from that text.
 */
type Dict = Record<string, string>;
/** Azerbaijani (the source language and the fallback) is always there; English and Russian are loaded when they are the active language, so they stay out of the first bundle. */
const DICT: Record<string, Dict> = { az };
const LOADERS: Record<string, () => Promise<{ default: Dict }>> = {
  en: () => import('./en.json') as unknown as Promise<{ default: Dict }>,
  ru: () => import('./ru.json') as unknown as Promise<{ default: Dict }>,
};

/**
 * Text packs: the texts of one lazy area (the admin pages, the weekly plan, supplements), kept out of the first bundle. A pack is merged into the dictionaries when
 * `loadPack` asks for it (the route guard of the area does that) and again for every language loaded afterwards.
 */
export type TextPack = 'admin' | 'plan' | 'supp';
const PACK_LOADERS: Record<TextPack, Record<string, () => Promise<{ default: Dict }>>> = {
  admin: {
    az: () => import('./admin.az.json') as unknown as Promise<{ default: Dict }>,
    en: () => import('./admin.en.json') as unknown as Promise<{ default: Dict }>,
    ru: () => import('./admin.ru.json') as unknown as Promise<{ default: Dict }>,
  },
  plan: {
    az: () => import('./plan.az.json') as unknown as Promise<{ default: Dict }>,
    en: () => import('./plan.en.json') as unknown as Promise<{ default: Dict }>,
    ru: () => import('./plan.ru.json') as unknown as Promise<{ default: Dict }>,
  },
  supp: {
    az: () => import('./supp.az.json') as unknown as Promise<{ default: Dict }>,
    en: () => import('./supp.en.json') as unknown as Promise<{ default: Dict }>,
    ru: () => import('./supp.ru.json') as unknown as Promise<{ default: Dict }>,
  },
};
const requestedPacks = new Set<TextPack>();
const mergedPacks = new Set<string>();

async function mergePacks(lang: string): Promise<void> {
  for (const pack of requestedPacks) {
    for (const l of new Set(['az', lang])) {
      const id = `${pack}:${l}`;
      if (mergedPacks.has(id) || !DICT[l] || !PACK_LOADERS[pack][l]) continue;
      DICT[l] = { ...DICT[l], ...(await PACK_LOADERS[pack][l]()).default };
      mergedPacks.add(id);
    }
  }
}

/** Loads the texts of a language (a no-op for one that is already there), plus the packs asked for so far. `t` uses them once the language is active, so load first, then switch. */
export async function loadLang(lang: string): Promise<void> {
  if (!DICT[lang] && LOADERS[lang]) DICT[lang] = (await LOADERS[lang]()).default;
  await mergePacks(lang);
}

/** Loads a text pack for the active language (and Azerbaijani, the fallback); call it before the screen that needs the texts is shown. */
export async function loadPack(pack: TextPack): Promise<void> {
  requestedPacks.add(pack);
  await loadLang(activeLang());
}

const CONTENT_PREFIXES = ['food.', 'meal.', 'slot.', 'unit.', 'trainer.', 'exercise.', 'safety.', 'tip.', 'phase.', 'dayType.', 'menu.'];

/** Azerbaijani content text -> its key. */
const CONTENT_KEY = new Map<string, string>(
  Object.entries(az as Dict)
    .filter(([key]) => CONTENT_PREFIXES.some((p) => key.startsWith(p)))
    .map(([key, text]) => [text, key]),
);

const fill = (text: string, params?: Record<string, string | number | null | undefined>): string =>
  params ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? '')) : text;

/** Text for a key in the active language ("{name}" placeholders come from params). Falls back to Azerbaijani, then to the key. */
export function t(key: string, params?: Record<string, string | number | null | undefined>): string {
  const lang = activeLang();
  return fill(DICT[lang]?.[key] ?? DICT['az'][key] ?? key, params);
}

/** Translation of built-in content text given in Azerbaijani (food, meal, tip …); unknown text (e.g. typed by the user) is returned unchanged. */
export function td(text: string): string {
  const key = CONTENT_KEY.get(text);
  return key ? t(key) : text;
}
