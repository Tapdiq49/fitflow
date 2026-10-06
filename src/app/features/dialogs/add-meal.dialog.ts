import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FOODS, FOOD_IDS } from '../../core/data/foods';
import { MealItem } from '../../core/models';
import { itemAmount, itemMacros, itemName, sumMacros } from '../../core/nutrition';
import { DayService } from '../../core/services/day.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { F, inputValue, nowHM, parseNum } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { TimePickerComponent } from '../../shared/time-picker.component';

@Component({
  selector: 'app-add-meal-dialog',
  imports: [ModalComponent, IconComponent, TimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal heading="Yemək əlavə et" (closed)="close()">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <label class="field">Yeməyin adı<input #name type="text" value="Əlavə yemək" /></label>
        <div class="field">Vaxt<app-time-picker label="Vaxt" [(value)]="time" /></div>
      </div>

      <div class="section-title" style="margin-top: 16px">Bazadan qida əlavə et</div>
      <div class="flex flex-wrap items-center gap-2">
        <select style="flex: 1; min-width: 180px" (change)="foodId.set(val($event))">
          @for (id of foodIds; track id) {
            <option [value]="id" [selected]="id === foodId()">{{ foods[id].name }} ({{ foods[id].unit }})</option>
          }
        </select>
        <input #amt type="text" inputmode="decimal" style="width: 90px" [value]="defaultAmount()" />
        <span class="text-muted">{{ foods[foodId()].unit }}</span>
        <button class="btn btn-sm" (click)="addFood(amt.value)" aria-label="Əlavə et"><app-icon name="plus" size="sm" /></button>
      </div>

      <div class="section-title" style="margin-top: 16px">və ya xüsusi qida (makroları özün yaz)</div>
      <div class="flex flex-wrap items-center gap-2">
        <input #cname type="text" placeholder="Ad" style="flex: 1; min-width: 120px" />
        <input #ck type="text" inputmode="numeric" placeholder="kcal" style="width: 70px" />
        <input #cp type="text" inputmode="decimal" placeholder="P" style="width: 60px" />
        <input #cc type="text" inputmode="decimal" placeholder="K" style="width: 60px" />
        <input #cf type="text" inputmode="decimal" placeholder="Y" style="width: 60px" />
        <button class="btn btn-sm" (click)="addCustom(cname, ck, cp, cc, cf)" aria-label="Əlavə et"><app-icon name="plus" size="sm" /></button>
      </div>

      <div style="margin-top: 14px">
        @if (items().length) {
          <div class="overflow-x-auto" style="border: 0">
            <table class="tbl">
              <thead>
                <tr><th>Qida</th><th class="tbl-num">Miqdar</th><th class="tbl-num">kcal</th><th class="tbl-num">P</th><th class="tbl-num">K</th><th class="tbl-num">Y</th><th></th></tr>
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
                    <td><button class="btn btn-ghost btn-icon btn-sm" (click)="remove(i)" aria-label="Sil"><app-icon name="x" size="sm" /></button></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">Cəmi</td>
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
          <div class="empty" style="padding: 14px">Hələ qida əlavə edilməyib</div>
        }
      </div>

      <label class="flex cursor-pointer items-center gap-2" style="margin-top: 12px"><input #done type="checkbox" checked /> Yeyilib kimi qeyd et</label>
      <div class="mt-[18px] flex justify-end gap-2">
        <button class="btn" (click)="close()">Ləğv et</button>
        <button class="btn btn-primary" (click)="save(name.value, time(), done.checked)"><app-icon name="save" size="sm" />Yadda saxla</button>
      </div>
    </app-modal>
  `,
})
export class AddMealDialog {
  protected readonly F = F;
  protected readonly val = inputValue;
  protected readonly foods = FOODS;
  protected readonly foodIds = FOOD_IDS;
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
      this.toast.show('Miqdarı daxil et');
      return;
    }
    this.items.update((l) => [...l, { food: this.foodId(), amt, base: amt }]);
  }

  protected addCustom(...inputs: HTMLInputElement[]): void {
    const [n, k, p, c, f] = inputs;
    const name = n.value.trim();
    if (!name) {
      this.toast.show('Qidanın adını yaz');
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
      this.toast.show('Ən azı bir qida əlavə et');
      return;
    }
    this.day.addMeal(this.ui.viewDate(), { name: name.trim() || 'Əlavə yemək', time: time || nowHM(), done, items: this.items() });
    this.close();
  }

  protected close(): void {
    this.ui.addMealOpen.set(false);
  }
}
