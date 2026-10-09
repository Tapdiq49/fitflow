import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectFieldComponent, SelectOption } from './select-field.component';

@Component({
  imports: [SelectFieldComponent],
  template: `<app-select-field label="Theme" [options]="options" [(value)]="value" />`,
})
class Host {
  readonly options: SelectOption<string>[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  readonly value = signal('light');
}

describe('SelectFieldComponent', () => {
  let fixture: ComponentFixture<Host>;
  const trigger = (): HTMLElement => fixture.nativeElement.querySelector('[role=combobox]');
  const options = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[role=option]'));
  const key = (k: string): void => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    fixture.detectChanges();
  };

  // jsdom has no scrollIntoView; the listbox / grid call it when the active item changes.
  beforeAll(() => (Element.prototype.scrollIntoView ??= () => {}));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  it('is a labelled, collapsed combobox showing the selected option', () => {
    expect(trigger().getAttribute('aria-label')).toBe('Theme');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Light');
    expect(options()).toHaveLength(0);
  });

  it('opens on click and picks the clicked option', async () => {
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['System', 'Light', 'Dark']);
    expect(options()[1].getAttribute('aria-selected')).toBe('true');

    options()[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('dark');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Dark');
  });

  it('works from the keyboard: ArrowDown opens, arrows move, Enter picks, Escape closes', async () => {
    trigger().focus();
    key('ArrowDown');
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    key('Escape');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.value()).toBe('light');

    key('Enter');
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options()).toHaveLength(3);
    key('Home');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(options()[0].id);
    key('Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('system');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });
});
