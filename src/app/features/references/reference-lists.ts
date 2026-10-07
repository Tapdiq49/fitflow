import { Injector } from '@angular/core';
import { FoodCatalogService } from '../../core/services/food-catalog.service';

/** One manageable list in the reference index. */
export interface ReferenceList {
  /** Route segment: the list opens at `/references/<id>` (add the route in `app.routes.ts` too). */
  id: string;
  icon: string;
  /** Translation keys. */
  label: string;
  summary: string;
  /** Number of entries, read inside a computed so it follows changes. */
  count: (injector: Injector) => number;
}

/**
 * Registry of the reference lists. A new list = one entry here, its page and route, and a service owning its data
 * (like `FoodCatalogService`). The index page needs no other change.
 */
export const REFERENCE_LISTS: readonly ReferenceList[] = [
  {
    id: 'foods',
    icon: 'utensils',
    label: 'references.foods',
    summary: 'references.foodsSummary',
    count: (injector) => injector.get(FoodCatalogService).entries().length,
  },
];
