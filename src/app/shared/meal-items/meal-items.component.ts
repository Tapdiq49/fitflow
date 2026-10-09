import { ChangeDetectionStrategy, Component, computed, inject, model, signal } from '@angular/core';
import { FOOD_IDS } from '../../core/data/foods';
import { MealItem } from '../../common/interfaces';
import { itemAmount, itemMacros, itemName, sumMacros } from '../../core/nutrition';
import { FoodCatalogService } from '../../core/services/food-catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { F, parseNum } from '../../core/utils';
import { IconComponent } from '../icon/icon.component';
import { SelectComponent, SelectOption } from '../forms/select.component';
import { TPipe, TdPipe } from '../../common/pipes/translate/t.pipe';
import { t, td } from '../../core/i18n/translate';

/**
 * The foods of one meal: a food of the reference list with an amount, or a food typed in with its own calories and macros, any number of
 * them. The calories, protein, carbohydrates and fat of every food and of the meal are worked out here (`itemMacros`).
 *
 * ```html
 * <app-meal-items [items]="meal.items" (itemsChange)="meal.items = $event" />
 * ```
 */
@Component({
  selector: 'app-meal-items',
  imports: [IconComponent, SelectComponent, TPipe, TdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="rounded-[calc(var(--r)_*_10px)] border border-border-soft bg-surface-2 p-2.5">
      @if (items().length) {
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th>{{ 'common.food' | t }}</th>
                <th class="tbl-num">{{ 'common.amount' | t }}</th>
                <th class="tbl-num">{{ 'addMeal.kcal' | t }}</th>
                <th class="tbl-num">{{ 'addMeal.p' | t }}</th>
                <th class="tbl-num">{{ 'addMeal.c' | t }}</th>
                <th class="tbl-num">{{ 'addMeal.f' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (it of items(); track $index; let i = $index) {
                @let x = macros(it);
                <tr>
                  <td class="tbl-text">{{ name(it) }}</td>
                  <td class="tbl-num">{{ amount(it) }}</td>
                  <td class="tbl-num">{{ F.round(x.k) }}</td>
                  <td class="tbl-num">{{ F.r1(x.p) }}</td>
                  <td class="tbl-num">{{ F.r1(x.c) }}</td>
                  <td class="tbl-num">{{ F.r1(x.f) }}</td>
                  <td><button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="remove(i)" [attr.aria-label]="'common.delete' | t"><app-icon name="x" size="sm" /></button></td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">{{ 'common.total' | t }}</td>
                <td class="tbl-num">{{ F.round(total().k) }}</td>
                <td class="tbl-num">{{ F.r1(total().p) }}</td>
                <td class="tbl-num">{{ F.r1(total().c) }}</td>
                <td class="tbl-num">{{ F.r1(total().f) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      } @else {
        <div class="py-1.5 text-center text-[0.8125rem] text-muted">{{ 'addMeal.noFoodAddedYet' | t }}</div>
      }

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <app-select class="min-w-[11.25rem] flex-1" [label]="'addMeal.addFoodFromDatabase' | t" [options]="foodOptions()" [(value)]="foodId" />
        <input #amt type="text" inputmode="decimal" class="w-[5.625rem]" [value]="defaultAmount()" [attr.aria-label]="'common.amount' | t" />
        <span class="text-muted">{{ foodUnit() | td }}</span>
        <button type="button" class="btn btn-sm" (click)="addFood(amt.value)" [attr.aria-label]="'addMeal.add' | t"><app-icon name="plus" size="sm" /></button>
      </div>

      <details class="mt-2">
        <summary class="cursor-pointer text-[0.75rem] text-muted">{{ 'addMeal.orCustomFoodEnter' | t }}</summary>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <input #cname type="text" [placeholder]="'addMeal.name' | t" class="min-w-[7.5rem] flex-1" />
          <input #ck type="text" inputmode="numeric" [placeholder]="'addMeal.kcal' | t" class="w-[4.375rem]" />
          <input #cp type="text" inputmode="decimal" [placeholder]="'addMeal.p' | t" class="w-[3.75rem]" />
          <input #cc type="text" inputmode="decimal" [placeholder]="'addMeal.c' | t" class="w-[3.75rem]" />
          <input #cf type="text" inputmode="decimal" [placeholder]="'addMeal.f' | t" class="w-[3.75rem]" />
          <button type="button" class="btn btn-sm" (click)="addCustom(cname, ck, cp, cc, cf)" [attr.aria-label]="'addMeal.add' | t"><app-icon name="plus" size="sm" /></button>
        </div>
      </details>
    </div>
  `,
})
export class MealItemsComponent {
  protected readonly F = F;
  protected readonly macros = itemMacros;
  protected readonly name = itemName;
  protected readonly amount = itemAmount;

  readonly items = model.required<MealItem[]>();

  private readonly catalog = inject(FoodCatalogService);
  private readonly toast = inject(ToastService);

  /** Food reference list (system + the user's own) in the active language. */
  protected readonly foodOptions = computed<SelectOption<string>[]>(() => this.catalog.entries().map((e) => ({ value: e.id, label: `${e.name} (${td(e.unit)})` })));
  protected readonly foodId = signal(FOOD_IDS[0]);
  protected readonly foodUnit = computed(() => this.catalog.find(this.foodId())?.unit ?? 'q');
  protected readonly defaultAmount = computed(() => (this.foodUnit() === 'q' ? 100 : 1));
  protected readonly total = computed(() => sumMacros(this.items().map(itemMacros)));

  protected addFood(raw: string): void {
    const amt = parseNum(raw);
    if (!(amt > 0)) {
      this.toast.show(t('addMeal.enterAmount'));
      return;
    }
    this.items.update((l) => [...l, this.catalog.toMealItem(this.foodId(), amt)]);
  }

  protected addCustom(...inputs: HTMLInputElement[]): void {
    const [n, k, p, c, f] = inputs;
    const name = n.value.trim();
    if (!name) {
      this.toast.show(t('addMeal.enterFoodName'));
      return;
    }
    const num = (el: HTMLInputElement): number => parseNum(el.value) || 0;
    this.items.update((l) => [...l, { name, amt: 1, k: num(k), p: num(p), c: num(c), f: num(f), amtLabel: '1 porsiya' }]);
    inputs.forEach((el) => (el.value = ''));
  }

  protected remove(i: number): void {
    this.items.update((l) => l.filter((_, j) => j !== i));
  }
}
