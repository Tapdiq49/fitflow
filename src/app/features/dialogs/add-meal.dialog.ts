import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FOODS, FOOD_IDS } from '../../core/data/foods';
import { MealItem } from '../../core/models';
import { itemAmount, itemMacros, itemName, sumMacros } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { F, nowHM, parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { SelectComponent, SelectOption } from '../../shared/forms/select.component';
import { TimePickerComponent } from '../../shared/forms/time-picker.component';
import { TPipe, TdPipe } from '../../shared/t.pipe';
import { t, td } from '../../core/i18n/translate';

@Component({
  selector: 'app-add-meal-dialog',
  imports: [ModalComponent, IconComponent, SelectComponent, TimePickerComponent, TPipe, TdPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [heading]="'addMeal.addMeal' | t" (closed)="close()">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <label class="field">{{ 'addMeal.mealName' | t }}<input #name type="text" value="Əlavə yemək" /></label>
        <div class="field">{{ 'addMeal.time' | t }}<app-time-picker [label]="'addMeal.time' | t" [(value)]="time" /></div>
      </div>

      <div class="section-title" style="margin-top: 16px">{{ 'addMeal.addFoodFromDatabase' | t }}</div>
      <div class="flex flex-wrap items-center gap-2">
        <app-select class="min-w-[180px] flex-1" [label]="'addMeal.addFoodFromDatabase' | t" [options]="foodOptions()" [(value)]="foodId" />
        <input #amt type="text" inputmode="decimal" style="width: 90px" [value]="defaultAmount()" />
        <span class="text-muted">{{ foods[foodId()].unit | td }}</span>
        <button class="btn btn-sm" (click)="addFood(amt.value)" [attr.aria-label]="'addMeal.add' | t"><app-icon name="plus" size="sm" /></button>
      </div>

      <div class="section-title" style="margin-top: 16px">{{ 'addMeal.orCustomFoodEnter' | t }}</div>
      <div class="flex flex-wrap items-center gap-2">
        <input #cname type="text" [placeholder]="'addMeal.name' | t" style="flex: 1; min-width: 120px" />
        <input #ck type="text" inputmode="numeric" [placeholder]="'addMeal.kcal' | t" style="width: 70px" />
        <input #cp type="text" inputmode="decimal" [placeholder]="'addMeal.p' | t" style="width: 60px" />
        <input #cc type="text" inputmode="decimal" [placeholder]="'addMeal.c' | t" style="width: 60px" />
        <input #cf type="text" inputmode="decimal" [placeholder]="'addMeal.f' | t" style="width: 60px" />
        <button class="btn btn-sm" (click)="addCustom(cname, ck, cp, cc, cf)" [attr.aria-label]="'addMeal.add' | t"><app-icon name="plus" size="sm" /></button>
      </div>

      <div style="margin-top: 14px">
        @if (items().length) {
          <div class="overflow-x-auto" style="border: 0">
            <table class="tbl">
              <thead>
                <tr><th>{{ 'common.food' | t }}</th><th class="tbl-num">{{ 'common.amount' | t }}</th><th class="tbl-num">{{ 'addMeal.kcal' | t }}</th><th class="tbl-num">{{ 'addMeal.p' | t }}</th><th class="tbl-num">{{ 'addMeal.c' | t }}</th><th class="tbl-num">{{ 'addMeal.f' | t }}</th><th></th></tr>
              </thead>
              <tbody>
                @for (it of items(); track $index; let i = $index) {
                  @let x = macros(it);
                  <tr>
                    <td class="tbl-text">{{ name_(it) }}</td>
                    <td class="tbl-num">{{ amount(it) }}</td>
                    <td class="tbl-num">{{ F.round(x.k) }}</td>
                    <td class="tbl-num">{{ F.r1(x.p) }}</td>
                    <td class="tbl-num">{{ F.r1(x.c) }}</td>
                    <td class="tbl-num">{{ F.r1(x.f) }}</td>
                    <td><button class="btn btn-ghost btn-icon btn-sm" (click)="remove(i)" [attr.aria-label]="'common.delete' | t"><app-icon name="x" size="sm" /></button></td>
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
          <div class="empty" style="padding: 14px">{{ 'addMeal.noFoodAddedYet' | t }}</div>
        }
      </div>

      <label class="flex cursor-pointer items-center gap-2" style="margin-top: 12px"><input #done type="checkbox" checked /> {{ 'addMeal.markAsEaten' | t }}</label>
      <div class="mt-[18px] flex justify-end gap-2">
        <button class="btn" (click)="close()">{{ 'common.cancel' | t }}</button>
        <button class="btn btn-primary" (click)="save(name.value, time(), done.checked)"><app-icon name="save" size="sm" />{{ 'common.save' | t }}</button>
      </div>
    </app-modal>
  `,
})
export class AddMealDialog {
  protected readonly F = F;
  protected readonly foods = FOODS;
  /** Food database in the active language. */
  protected readonly foodOptions = computed<SelectOption<string>[]>(() => FOOD_IDS.map((id) => ({ value: id, label: `${td(FOODS[id].name)} (${td(FOODS[id].unit)})` })));
  protected readonly macros = itemMacros;
  protected readonly name_ = itemName;
  protected readonly amount = itemAmount;
  protected readonly time = signal(nowHM());

  private readonly ui = inject(UiService);
  private readonly day = inject(DayService);
  private readonly toast = inject(ToastService);

  protected readonly foodId = signal(FOOD_IDS[0]);
  protected readonly defaultAmount = computed(() => (FOODS[this.foodId()].unit === 'q' ? 100 : 1));
  protected readonly items = signal<MealItem[]>([]);
  protected readonly total = computed(() => sumMacros(this.items().map(itemMacros)));

  protected addFood(raw: string): void {
    const amt = parseNum(raw);
    if (!(amt > 0)) {
      this.toast.show(t('addMeal.enterAmount'));
      return;
    }
    this.items.update((l) => [...l, { food: this.foodId(), amt, base: amt }]);
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

  protected save(name: string, time: string, done: boolean): void {
    if (!this.items().length) {
      this.toast.show(t('addMeal.addAtLeastOne'));
      return;
    }
    this.day.addMeal(this.ui.viewDate(), { name: name.trim() || t('addMeal.extraMeal'), time: time || nowHM(), done, items: this.items() });
    this.close();
  }

  protected close(): void {
    this.ui.addMealOpen.set(false);
  }
}
