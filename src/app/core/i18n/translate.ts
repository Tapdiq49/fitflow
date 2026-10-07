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

/** Loads the texts of a language (a no-op for one that is already there). `t` uses them once the language is active, so load first, then switch. */
export async function loadLang(lang: string): Promise<void> {
  if (DICT[lang] || !LOADERS[lang]) return;
  DICT[lang] = (await LOADERS[lang]()).default;
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
