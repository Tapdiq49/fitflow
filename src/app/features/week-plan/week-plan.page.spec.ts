import { ComponentFixture, TestBed } from '@angular/core/testing';
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
