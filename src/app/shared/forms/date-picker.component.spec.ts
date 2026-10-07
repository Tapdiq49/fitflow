import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePickerComponent } from './date-picker.component';

@Component({
  imports: [DatePickerComponent],
  template: `<app-date-picker label="Date" [(value)]="value" [max]="max" />`,
})
class Host {
  readonly value = signal('2026-10-07');
  readonly max = '2026-10-10';
}

describe('DatePickerComponent', () => {
  let fixture: ComponentFixture<Host>;
  const trigger = (): HTMLElement => fixture.nativeElement.querySelector('[role=combobox]');
  const cells = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[role=gridcell]'));
  const cell = (key: string): HTMLElement => cells().find((c) => c.id.endsWith(key))!;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const open = async (): Promise<void> => {
    trigger().click();
    await settle();
  };

  // jsdom has no scrollIntoView; the grid calls it when the active item changes.
  beforeAll(() => (Element.prototype.scrollIntoView ??= () => {}));

  beforeEach(async () => {
    localStorage.clear();
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  afterEach(() => fixture.destroy());

  it('shows the date as DD.MM.YYYY and opens a month with the date selected', async () => {
    expect(trigger().textContent).toContain('07.10.2026');
    await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('Oktyabr 2026'); // month name in the app language
    expect(cells()).toHaveLength(42);
    expect(cell('2026-10-07').getAttribute('aria-selected')).toBe('true');
  });

  it('picks a day, closes, and keeps the DD.MM.YYYY format', async () => {
    await open();
    cell('2026-10-02').click();
    await settle();
    expect(fixture.componentInstance.value()).toBe('2026-10-02');
    expect(trigger().textContent).toContain('02.10.2026');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('does not let a day after the maximum be picked', async () => {
    await open();
    expect(cell('2026-10-11').getAttribute('aria-disabled')).toBe('true');
    cell('2026-10-11').click();
    await settle();
    expect(fixture.componentInstance.value()).toBe('2026-10-07');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('moves between months, but not into a month that has only days after the maximum', async () => {
    await open();
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]'));
    const [prev, next] = [buttons.find((b) => b.getAttribute('aria-label') === 'Əvvəlki ay')!, buttons.find((b) => b.getAttribute('aria-label') === 'Növbəti ay')!];
    expect(next.disabled).toBe(true); // November starts after the maximum
    prev.click();
    await settle();
    expect(document.body.textContent).toContain('Sentyabr 2026');
    expect(next.disabled).toBe(false);
  });
});
