import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectOption } from '../select-field/select-field.component';
import { MultiselectFieldComponent } from './multiselect-field.component';

@Component({
  imports: [MultiselectFieldComponent],
  template: `<app-multiselect-field label="Days" placeholder="None" [options]="options" [(value)]="value" />`,
})
class Host {
  readonly options: SelectOption<number>[] = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
  ];
  readonly value = signal<number[]>([3]);
}

describe('MultiselectFieldComponent', () => {
  let fixture: ComponentFixture<Host>;
  const trigger = (): HTMLElement => fixture.nativeElement.querySelector('[role=combobox]');
  const options = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[role=option]'));
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  // jsdom has no scrollIntoView; the listbox calls it when the active item changes.
  beforeAll(() => (Element.prototype.scrollIntoView ??= () => {}));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await settle();
  });

  afterEach(() => fixture.destroy());

  it('is a labelled, collapsed combobox listing the chosen options', () => {
    expect(trigger().getAttribute('aria-label')).toBe('Days');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Wed');
    expect(options()).toHaveLength(0);
  });

  it('shows the placeholder while nothing is chosen', async () => {
    fixture.componentInstance.value.set([]);
    await settle();
    expect(trigger().textContent).toContain('None');
  });

  it('ticks several options without closing and keeps them in option order', async () => {
    trigger().click();
    await settle();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);

    options()[0].click();
    await settle();
    expect(fixture.componentInstance.value()).toEqual([1, 3]);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().textContent).toContain('Mon, Wed');

    options()[2].click();
    await settle();
    expect(fixture.componentInstance.value()).toEqual([1]);
  });
});
