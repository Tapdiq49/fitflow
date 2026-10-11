import { signal } from '@angular/core';
import { TEMPLATES } from './data/meals';
import { MealTemplate, SystemMealTemplate, TemplateKey } from '../common/interfaces';

/**
 * The meal templates the app works with, from the backend (published by MealCatalogService: the saved copy at start, the live list once
 * it has been read). A signal, like `systemFoods`, so the menu generator follows loads. Until anything has been published
 * (first visit without a connection) `data/meals.ts` is the last-resort copy.
 */
export const systemMealTemplates = signal<readonly SystemMealTemplate[]>([]);

/** The templates of one pool in their order, as the menu generator reads them (the name is the Azerbaijani one a saved menu keeps). */
export function templatesOf(key: TemplateKey): MealTemplate[] {
  const live = systemMealTemplates().filter((t) => t.slot === key);
  // A pool the backend left empty falls back to the built-in templates: the generator always has a meal to give.
  if (!live.length) return [...(TEMPLATES[key] ?? [])];
  return live
    .sort((a, b) => a.position - b.position)
    .map((t) => ({ id: t.code, name: t.names.az ?? '', main: t.main ?? undefined, light: t.light || undefined, items: t.items }));
}
