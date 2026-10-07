import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimePickerComponent } from './time-picker.component';

@Component({
  imports: [TimePickerComponent],
  template: `<app-time-picker label="Started" [(value)]="value" />`,
})
class Host {
  readonly value = signal('18:30');
}

describe('TimePickerComponent', () => {
  let fixture: ComponentFixture<Host>;
  const trigger = (): HTMLElement => fixture.nativeElement.querySelector('[role=combobox]');
  const cell = (text: string, group: 0 | 1): HTMLElement =>
    Array.from(document.querySelectorAll<HTMLElement>('[role=rowgroup]')[group].querySelectorAll<HTMLElement>('[role=gridcell]')).find((c) => c.textContent?.trim() === text)!;
  const open = async (): Promise<void> => {
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  // jsdom has no scrollIntoView; the listbox / grid call it when the active item changes.
  beforeAll(() => (Element.prototype.scrollIntoView ??= () => {}));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  it('opens a grid with the current hour and minute selected', async () => {
    expect(trigger().textContent).toContain('18:30');
    await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role=grid]')).not.toBeNull();
    expect(cell('18', 0).getAttribute('aria-selected')).toBe('true');
    expect(cell('30', 1).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the popup open after an hour and closes it after a minute', async () => {
    await open();
    cell('07', 0).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('07:30');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    cell('45', 1).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('07:45');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the hour selected when the selected hour is clicked again', async () => {
    await open();
    cell('18', 0).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('18:30');
    expect(cell('18', 0).getAttribute('aria-selected')).toBe('true');
  });

  it('works from the keyboard: arrows move across hours and minutes, Enter picks', async () => {
    const key = (k: string): void => {
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      fixture.detectChanges();
    };
    trigger().focus();
    key('ArrowDown');
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const active = (): string => document.getElementById(trigger().getAttribute('aria-activedescendant')!)!.textContent!.trim();
    expect(active()).toBe('18'); // starts on the selected hour
    key('ArrowUp');
    key('ArrowUp');
    key('ArrowRight');
    expect(active()).toBe('07');
    key('Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('07:30');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    for (let i = 0; i < 3; i++) key('ArrowDown'); // past the hours into the minute rows
    expect(active()).toBe('05');
    key('Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('07:05');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('shows only one popup at a time across pickers', async () => {
    const other = TestBed.createComponent(Host);
    other.detectChanges();
    await open();
    const otherTrigger: HTMLElement = other.nativeElement.querySelector('[role=combobox]');
    otherTrigger.focus();
    trigger().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: otherTrigger }));
    otherTrigger.click();
    other.detectChanges();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    other.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(otherTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('[role=grid]')).toHaveLength(1);
    other.destroy();
  });
});
