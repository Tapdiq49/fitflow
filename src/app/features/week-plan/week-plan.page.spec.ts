import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateU } from '../../core/utils';
import { StoreService } from '../../core/services/store.service';
import { TrainerPlanService } from '../../core/services/trainer-plan.service';
import { WeekPlanPage } from './week-plan.page';

describe('WeekPlanPage tabs and gym days', () => {
  let fixture: ComponentFixture<WeekPlanPage>;
  const q = <T extends HTMLElement>(sel: string): T[] => Array.from(fixture.nativeElement.querySelectorAll(sel));
  const render = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeAll(() => (Element.prototype.scrollIntoView ??= () => {}));

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(WeekPlanPage);
    await render();
  });

  it('shows the meal plan tab first and switches tabs with the tab list', async () => {
    const tabs = q('[role=tab]');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(q('[role=tabpanel]:not([inert])')).toHaveLength(1);
    expect(q('[role=listbox]')).toHaveLength(0);

    tabs[1].click();
    await render();
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(q('[role=listbox]')).toHaveLength(1);
  });

  it('asks for height and weight at the top while they are missing, and stops asking once they are saved', async () => {
    expect(q('.alert-info')[0].textContent).toContain('boyunu');
    const [h, w, a] = q<HTMLInputElement>('.alert-info input');
    h.value = '180';
    h.dispatchEvent(new Event('input'));
    w.value = '85';
    w.dispatchEvent(new Event('input'));
    a.value = '35';
    a.dispatchEvent(new Event('input'));
    q<HTMLButtonElement>('.alert-info [role=radio]')[1].click(); // female
    q<HTMLButtonElement>('.alert-info button').find((b) => b.textContent?.includes('Yadda saxla'))!.click();
    await render();
    expect(TestBed.inject(StoreService).settings()).toMatchObject({ height: 180, startWeight: 85, age: 35, sex: 'female' });
    expect(q('.alert-info').some((a) => a.textContent?.includes('boyunu'))).toBe(false);
  });

  it('tells the user the automatic menu is in use, with a link to the settings', () => {
    const alert = q('.alert-info').find((a) => a.textContent?.includes('avtomatik menyu'))!;
    expect(alert.textContent).toContain('avtomatik menyu istifadə olunur');
    expect(alert.querySelector('a')?.getAttribute('href')).toBe('/settings');
  });

  it('adds a meal to a day and removes another, then saves the new number of meals', async () => {
    const first = (): HTMLElement => q('.card')[1]; // Monday
    const rows = (): number => first().querySelectorAll('input[type=text]').length;
    expect(rows()).toBe(0); // a new user starts with an empty plan
    expect(first().textContent).toContain('Təklif'); // and the built-in plan is only offered

    Array.from(first().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Təklifi əlavə et'))!.click();
    await render();
    expect(rows()).toBe(5);
    expect(first().textContent).not.toContain('Təklifi əlavə et'); // the offer goes away once the day has meals
    expect(Array.from(first().querySelectorAll('button')).some((b) => b.textContent?.includes('Məşqdən əvvəl'))).toBe(true);

    Array.from(first().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Məşqdən əvvəl'))!.click();
    await render();
    expect(rows()).toBe(6);

    first().querySelector<HTMLButtonElement>('button[aria-label^="Sil"]')!.click();
    await render();
    expect(rows()).toBe(5);
    expect(Array.from(first().querySelectorAll('button')).some((b) => b.textContent?.includes('Səhər yeməyi'))).toBe(true); // the removed meal can be added back
  });

  it('picks gym days with the multi-select listbox and saves them', async () => {
    q('[role=tab]')[1].click();
    await render();
    const days = q('[role=option]');
    expect(days.filter((d) => d.getAttribute('aria-selected') === 'true')).toHaveLength(3); // Mon/Wed/Fri

    days[2].click(); // Wednesday off
    days[5].click(); // Saturday on
    await render();
    expect(days.map((d) => d.getAttribute('aria-selected') === 'true')).toEqual([true, false, false, false, true, true, false]);

    q<HTMLButtonElement>('button.btn-primary').find((b) => b.textContent?.includes('Məşq planını'))!.click();
    expect(TestBed.inject(TrainerPlanService).gymDays(DateU.monday(DateU.today()))).toEqual([1, 5, 6]);
    expect(TestBed.inject(StoreService).state().workoutPlans).not.toEqual({});
  });
});
