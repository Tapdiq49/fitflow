import { AccordionContent, AccordionGroup, AccordionPanel, AccordionTrigger } from '@angular/aria/accordion';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, model, signal } from '@angular/core';
import { MealItem, Unit } from '../../common/interfaces';
import { UNITS, addItem, itemAmount, itemMacros, itemName, per100, sumMacros } from '../../core/nutrition';
import { FoodCatalogService } from '../../core/services/food-catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { F, parseNum } from '../../core/utils';
import { IconComponent } from '../icon/icon.component';
import { SelectFieldComponent, SelectOption } from '../forms/select-field/select-field.component';
import { TPipe, TdPipe } from '../../common/pipes/translate/t.pipe';
import { t, td } from '../../core/i18n/translate';
import { TextFieldComponent } from '../forms/text-field/text-field.component';
import { NumberFieldComponent } from '../forms/number-field/number-field.component';
import { FieldValue } from '../forms/field-base/field-base';

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
  imports: [TextFieldComponent, NumberFieldComponent, AccordionGroup, AccordionTrigger, AccordionPanel, AccordionContent, IconComponent, SelectFieldComponent, TPipe, TdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!--
      The foods can be folded away (Angular Aria accordion). Look of an FAQ accordion: a flat item with a line under it, a title that is
      underlined on hover, a chevron that turns, a panel that slides open and fades in; what the foods add up to stays visible.
    -->
    <div ngAccordionGroup class="animate-rise">
      <button
        ngAccordionTrigger
        type="button"
        class="flex w-full cursor-pointer appearance-none items-center justify-between gap-3 rounded-[calc(var(--r)_*_10px)] border-0 px-2.5 py-3.5 text-left text-[0.875rem] font-semibold text-text [transition:background_.15s] hover:bg-surface-2"
        [class]="open() ? 'bg-surface-2' : 'bg-transparent'"
        [panel]="panel"
        [(expanded)]="open"
      >
        <span>{{ 'plan.mealFoods' | t }}</span>
        <span class="flex items-center gap-3 text-[0.8125rem] font-normal text-muted tabular-nums">
          {{ 'plan.mealFoodsSummary' | t: { n: items().length, k: F.round(total().k) } }}
          <!-- One plus that turns by 45 degrees into a cross while the item is open. It sits in a span of its own: the icon element is display:contents, which has no box to turn. -->
          <span class="inline-grid shrink-0 place-items-center text-text [transition:transform_.2s_ease]" [style.transform]="open() ? 'rotate(45deg)' : 'rotate(0deg)'">
            <app-icon name="plus" />
          </span>
        </span>
      </button>
      <!-- The panel keeps its content while folded so the height can animate (grid rows 0fr to 1fr). -->
      <div class="grid [transition:grid-template-rows_.25s_ease,opacity_.25s_ease]" [class]="open() ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'">
      <div ngAccordionPanel #panel="ngAccordionPanel" [preserveContent]="true" class="min-h-0 overflow-hidden">
      <ng-template ngAccordionContent>
      <div class="mt-2.5 mb-3.5 rounded-[calc(var(--r)_*_14px)] border border-border-soft bg-surface-2 p-3.5">
      @if (items().length) {
        <!-- One card per food: the name and amount, the macros as small chips, the calories, a delete button. -->
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (it of items(); track $index; let i = $index) {
            @let x = macros(it);
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[calc(var(--r)_*_12px)] border border-border-soft bg-surface px-3.5 py-2.5">
              <div class="min-w-[9rem] flex-1">
                <b class="block text-[0.875rem] font-semibold">{{ name(it) }}</b>
                <span class="text-[0.75rem] text-muted tabular-nums">{{ amount(it) }}</span>
              </div>
              <div class="flex items-center gap-1.5 text-[0.75rem] tabular-nums">
                <span class="rounded-full bg-surface-2 px-2 py-0.5 text-text-2">{{ 'dash.protein' | t }} <b>{{ F.r1(x.p) }}</b> {{ 'q' | td }}</span>
                <span class="rounded-full bg-surface-2 px-2 py-0.5 text-text-2">{{ 'dash.carbs' | t }} <b>{{ F.r1(x.c) }}</b> {{ 'q' | td }}</span>
                <span class="rounded-full bg-surface-2 px-2 py-0.5 text-text-2">{{ 'dash.fat' | t }} <b>{{ F.r1(x.f) }}</b> {{ 'q' | td }}</span>
              </div>
              <b class="w-[4.5rem] text-right text-[0.9375rem] tabular-nums">{{ F.round(x.k) }} <small class="font-normal text-muted">{{ 'addMeal.kcal' | t }}</small></b>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="remove(i)" [attr.aria-label]="'common.delete' | t"><app-icon name="x" size="sm" /></button>
            </li>
          }
        </ul>
        <!-- The total of the meal. -->
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[calc(var(--r)_*_12px)] bg-accent/10 px-3.5 py-2.5">
          <span class="text-[0.8125rem] font-semibold">{{ 'common.total' | t }}</span>
          <div class="flex flex-wrap items-center gap-2 text-[0.8125rem] tabular-nums">
            <span class="text-text-2">{{ 'dash.protein' | t }} <b>{{ F.r1(total().p) }}</b> {{ 'q' | td }}</span>
            <span class="text-text-2">{{ 'dash.carbs' | t }} <b>{{ F.r1(total().c) }}</b> {{ 'q' | td }}</span>
            <span class="text-text-2">{{ 'dash.fat' | t }} <b>{{ F.r1(total().f) }}</b> {{ 'q' | td }}</span>
            <b class="text-[0.9375rem]">{{ F.round(total().k) }} {{ 'addMeal.kcal' | t }}</b>
          </div>
        </div>
      } @else {
        <div class="py-1.5 text-center text-[0.8125rem] text-muted">{{ 'addMeal.noFoodAddedYet' | t }}</div>
      }

      <!-- Half the width, on the left (not narrower than the food, amount and unit need; full width on small screens). -->
      <div class="mt-2 flex w-1/2 min-w-[22rem] max-w-full flex-wrap items-center gap-2 tablet:w-full">
        <app-select-field class="min-w-[11.25rem] flex-1" [label]="'addMeal.addFoodFromDatabase' | t" [options]="foodOptions()" [placeholder]="'plan.chooseFood' | t" [(value)]="foodId" />
        <app-number-field #amt width="5.625rem" decimal [placeholder]="'common.amount' | t" [label]="'common.amount' | t" />
        @if (foodId()) {
          <span class="text-muted">{{ foodUnit() | td }}</span>
        }
        <button type="button" class="btn btn-sm" (click)="addFood(amt)" [attr.aria-label]="'addMeal.add' | t"><app-icon name="plus" size="sm" /></button>
      </div>

      <details class="mt-2">
        <summary class="cursor-pointer text-[0.75rem] text-muted">{{ 'addMeal.orCustomFoodEnter' | t }}</summary>
        <div class="mt-2 flex w-1/2 min-w-[28rem] max-w-full flex-wrap items-center gap-2 tablet:w-full">
          <app-text-field #cname class="min-w-[7.5rem] flex-1" [placeholder]="'addMeal.name' | t" />
          <app-number-field #camt width="4.5rem" decimal [placeholder]="'common.amount' | t" [label]="'common.amount' | t" />
          <app-select-field class="w-[5.5rem]" [label]="'references.unit' | t" [options]="unitOptions" [placeholder]="'plan.chooseFood' | t" [(value)]="customUnit" />
          <app-number-field #ck width="4.5rem" [placeholder]="'addMeal.kcal' | t" [label]="'addMeal.kcal' | t" />
          <app-number-field #cp width="5.5rem" decimal [placeholder]="'dash.protein' | t" [label]="'dash.protein' | t" />
          <app-number-field #cc width="7rem" decimal [placeholder]="'dash.carbs' | t" [label]="'dash.carbs' | t" />
          <app-number-field #cf width="4.5rem" decimal [placeholder]="'dash.fat' | t" [label]="'dash.fat' | t" />
          <button type="button" class="btn btn-sm" (click)="addCustom(cname, camt, ck, cp, cc, cf)" [attr.aria-label]="'addMeal.add' | t"><app-icon name="plus" size="sm" /></button>
        </div>
        @if (customUnit()) {
          <p class="m-0 mt-1.5 text-[0.75rem] text-muted">{{ 'plan.customPer' | t: { v: customPerLabel() } }}</p>
        }
      </details>
      </div>
      </ng-template>
      </div>
      </div>
    </div>
  `,
})
export class MealItemsComponent implements OnInit {
  protected readonly F = F;
  protected readonly macros = itemMacros;
  protected readonly name = itemName;
  protected readonly amount = itemAmount;

  readonly items = model.required<MealItem[]>();
  /** Open while there are no foods yet (so the first one is easy to add), folded once there are; the user decides after that. */
  protected readonly open = signal(false);

  ngOnInit(): void {
    this.open.set(this.items().length === 0);
  }

  private readonly catalog = inject(FoodCatalogService);
  private readonly toast = inject(ToastService);

  /** Food reference list (system + the user's own) in the active language. */
  protected readonly foodOptions = computed<SelectOption<string>[]>(() => this.catalog.entries().map((e) => ({ value: e.id, label: `${e.name} (${td(e.unit)})` })));
  /** The chosen food; '' while none is chosen (the select then shows its placeholder). */
  protected readonly foodId = signal('');
  protected readonly foodUnit = computed(() => this.catalog.find(this.foodId())?.unit ?? 'q');
  protected readonly total = computed(() => sumMacros(this.items().map(itemMacros)));

  /** Adds the food, then clears the choice and the amount, ready for the next one. */
  protected addFood(input: FieldValue): void {
    if (!this.foodId()) {
      this.toast.show(t('plan.chooseFood'));
      return;
    }
    const amt = parseNum(input.value);
    if (!(amt > 0)) {
      this.toast.show(t('addMeal.enterAmount'));
      return;
    }
    this.items.update((l) => addItem(l, this.catalog.toMealItem(this.foodId(), amt)));
    this.foodId.set('');
    input.value = '';
  }

  /** The units of a typed-in food; its numbers are per 100 (q, ml) or per one (the others), like the foods of the list. */
  protected readonly unitOptions: SelectOption<string>[] = UNITS.map((u) => ({ value: u, label: td(u) }));
  /** The chosen unit; '' while none is chosen (the select then shows its placeholder). The amount starts empty too. */
  protected readonly customUnit = signal('');
  protected readonly customPerLabel = computed(() => `${per100(this.customUnit() as Unit) ? 100 : 1} ${td(this.customUnit())}`);

  protected addCustom(...inputs: FieldValue[]): void {
    const [n, a, k, p, c, f] = inputs;
    const name = n.value.trim();
    if (!name) {
      this.toast.show(t('addMeal.enterFoodName'));
      return;
    }
    if (!this.customUnit()) {
      this.toast.show(t('plan.chooseFood'));
      return;
    }
    const amt = parseNum(a.value);
    if (!(amt > 0)) {
      this.toast.show(t('addMeal.enterAmount'));
      return;
    }
    const num = (el: FieldValue): number => parseNum(el.value) || 0;
    this.items.update((l) => addItem(l, { name, amt, unit: this.customUnit() as Unit, per: { k: num(k), p: num(p), c: num(c), f: num(f) } }));
    [n, a, k, p, c, f].forEach((el) => (el.value = ''));
    this.customUnit.set('');
  }

  protected remove(i: number): void {
    this.items.update((l) => l.filter((_, j) => j !== i));
  }
}
