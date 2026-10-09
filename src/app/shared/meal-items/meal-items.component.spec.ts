import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MealItem } from '../../common/interfaces';
import { AuthService } from '../../core/auth/auth.service';
import { FakeAuthService } from '../../core/auth/fake-auth.service';
import { itemMacros } from '../../core/nutrition';
import { FakeFoodRepository } from '../../core/repositories/fake-food.repository';
import { FoodRepository } from '../../core/repositories/food.repository';
import { MealItemsComponent } from './meal-items.component';

@Component({
  imports: [MealItemsComponent],
  template: `<app-meal-items [items]="items()" (itemsChange)="items.set($event)" />`,
})
class HostComponent {
  readonly items = signal<MealItem[]>([]);
}

/** The protected members the tests drive, as the buttons and fields of the block would. */
interface Internals {
  foodId: WritableSignal<string>;
  customUnit: WritableSignal<string>;
  addFood(input: { value: string }): void;
  addCustom(...inputs: { value: string }[]): void;
}

const egg = (amt: number): MealItem => ({ food: 'egg', amt, unit: 'ədəd', per: { k: 78, p: 6.3, c: 0.6, f: 5.3 } });

describe('MealItemsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let internals: Internals;
  const text = (): string => fixture.nativeElement.textContent as string;
  const field = (v: string): { value: string } => ({ value: v });
  const render = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const create = async (items: MealItem[]): Promise<void> => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.items.set(items);
    await render();
    internals = fixture.debugElement.query(By.directive(MealItemsComponent)).componentInstance as unknown as Internals;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: new FakeAuthService() },
        { provide: FoodRepository, useValue: new FakeFoodRepository() },
      ],
    });
  });

  it('opens while there are no foods, and folds once there are, with the sum on the header', async () => {
    await create([]);
    expect(fixture.nativeElement.querySelector('[ngAccordionTrigger]').getAttribute('aria-expanded')).toBe('true');
    await create([egg(2)]);
    expect(fixture.nativeElement.querySelector('[ngAccordionTrigger]').getAttribute('aria-expanded')).toBe('false');
    expect(text()).toContain('156'); // 2 eggs, 156 kcal, readable while folded
  });

  it('shows every food as a card with its amount, macros and calories, and the total of the meal', async () => {
    await create([egg(2)]);
    fixture.nativeElement.querySelector('[ngAccordionTrigger]').click();
    await render();
    const cards = fixture.nativeElement.querySelectorAll('li');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Yumurta');
    expect(cards[0].textContent).toContain('2 ədəd');
    expect(cards[0].textContent).toContain('156');
    expect(text()).toContain('12.6'); // protein of 2 eggs
  });

  it('removes a food', async () => {
    await create([egg(1), { name: 'Çay', amt: 1, k: 20, p: 0, c: 4, f: 0 }]);
    fixture.nativeElement.querySelector('[ngAccordionTrigger]').click();
    await render();
    fixture.nativeElement.querySelector('li button').click();
    await render();
    expect(fixture.componentInstance.items().map((i) => i.name ?? i.food)).toEqual(['Çay']);
  });

  it('adds more of a food that is already there instead of a second line, then clears the choice', async () => {
    await create([]);
    internals.foodId.set('egg');
    internals.addFood(field('1'));
    internals.foodId.set('egg');
    internals.addFood(field('2'));
    const items = fixture.componentInstance.items();
    expect(items).toHaveLength(1);
    expect(items[0].amt).toBe(3);
    expect(internals.foodId()).toBe('');
  });

  it('adds nothing while no food is chosen or the amount is empty', async () => {
    await create([]);
    internals.addFood(field('2')); // no food
    internals.foodId.set('egg');
    internals.addFood(field('')); // no amount
    internals.addFood(field('0'));
    expect(fixture.componentInstance.items()).toEqual([]);
    expect(internals.foodId()).toBe('egg'); // the choice stays for another try
  });

  it('adds a typed-in food with its unit, amount and numbers per unit', async () => {
    await create([]);
    internals.customUnit.set('x/q');
    internals.addCustom(field('Zeytun yağı'), field('2'), field('119'), field('0'), field('0'), field('13.5'));
    const [oil] = fixture.componentInstance.items();
    expect(oil).toMatchObject({ name: 'Zeytun yağı', amt: 2, unit: 'x/q', per: { k: 119, p: 0, c: 0, f: 13.5 } });
    expect(itemMacros(oil).k).toBeCloseTo(238, 5);
    expect(internals.customUnit()).toBe(''); // ready for the next one
  });

  it('refuses a typed-in food without a name, a unit or an amount', async () => {
    await create([]);
    internals.addCustom(field(''), field('2'), field('1'), field('0'), field('0'), field('0')); // no name
    internals.addCustom(field('Zeytun yağı'), field('2'), field('1'), field('0'), field('0'), field('0')); // no unit
    internals.customUnit.set('x/q');
    internals.addCustom(field('Zeytun yağı'), field(''), field('1'), field('0'), field('0'), field('0')); // no amount
    expect(fixture.componentInstance.items()).toEqual([]);
  });

  it('puts an empty number in a typed-in food as 0', async () => {
    await create([]);
    internals.customUnit.set('ml');
    internals.addCustom(field('Süd'), field('250'), field('60'), field(''), field(''), field(''));
    expect(itemMacros(fixture.componentInstance.items()[0])).toEqual({ k: 150, p: 0, c: 0, f: 0 });
  });
});
