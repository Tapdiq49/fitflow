import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberFieldComponent, cleanNumberText } from './number-field.component';

@Component({
  imports: [NumberFieldComponent],
  template: `
    <app-number-field #amount decimal width="4.5rem" inputClass="text-center" [value]="num()" [label]="'Miqdar'" [placeholder]="'Miqdar'" [invalid]="bad()" (input)="seen.push($any($event.target).value)" />
    <app-number-field [step]="5" [max]="12" value="10" />
    <app-number-field disabled />
    <app-number-field [stepper]="false" />
  `,
})
class HostComponent {
  readonly num = signal('2');
  readonly bad = signal(false);
  readonly seen: string[] = [];
}

describe('cleanNumberText', () => {
  it('keeps only digits where decimals are not allowed', () => {
    expect(cleanNumberText('12abc3', false)).toBe('123');
    expect(cleanNumberText('-5.5', false)).toBe('55');
    expect(cleanNumberText(' 7 8 ', false)).toBe('78');
    expect(cleanNumberText('', false)).toBe('');
  });

  it('keeps one decimal mark, a point or a comma, where decimals are allowed', () => {
    expect(cleanNumberText('1.2.3', true)).toBe('1.23');
    expect(cleanNumberText('1,5', true)).toBe('1,5');
    expect(cleanNumberText('1,5.5', true)).toBe('1,55');
    expect(cleanNumberText('x.5', true)).toBe('.5');
  });
});

describe('NumberFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const inputs = (): HTMLInputElement[] => Array.from(fixture.nativeElement.querySelectorAll('input'));
  const buttons = (field: number): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('app-number-field')[field].querySelectorAll('button'));
  const typeIn = (el: HTMLInputElement, text: string): void => {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('is a text input with the numeric keyboard (decimal or whole numbers)', () => {
    const [decimal, whole] = inputs();
    expect(decimal.getAttribute('type')).toBe('text');
    expect(decimal.getAttribute('inputmode')).toBe('decimal');
    expect(whole.getAttribute('inputmode')).toBe('numeric');
    expect(decimal.value).toBe('2');
    expect(decimal.placeholder).toBe('Miqdar');
    expect(decimal.getAttribute('aria-label')).toBe('Miqdar');
  });

  it('takes the size on the element and the alignment on the input, and marks a wrong value', () => {
    const host: HTMLElement = fixture.nativeElement.querySelector('app-number-field');
    expect(host.style.width).toBe('4.5rem');
    expect(inputs()[0].className).toContain('text-center');
    expect(inputs()[0].getAttribute('aria-invalid')).toBeNull();
    fixture.componentInstance.bad.set(true);
    fixture.detectChanges();
    expect(inputs()[0].getAttribute('aria-invalid')).toBe('true');
  });

  it('drops letters and signs as they are typed or pasted, before the listeners of the field hear it', () => {
    typeIn(inputs()[0], '2x.5');
    expect(inputs()[0].value).toBe('2.5');
    expect(fixture.componentInstance.seen.at(-1)).toBe('2.5');
    typeIn(inputs()[1], '1-2a');
    expect(inputs()[1].value).toBe('12');
  });

  it('counts up and down with the buttons by 0.5 on a decimal field, never below 0', () => {
    const [up, down] = buttons(0);
    up.click();
    expect(inputs()[0].value).toBe('2.5');
    down.click();
    down.click();
    expect(inputs()[0].value).toBe('1.5');
    for (let i = 0; i < 5; i++) down.click();
    expect(inputs()[0].value).toBe('0');
  });

  it('counts by the given step and stops at the largest number', () => {
    const [up, down] = buttons(1);
    up.click();
    expect(inputs()[1].value).toBe('12'); // 10 + 5 is over 12
    up.click();
    expect(inputs()[1].value).toBe('12');
    down.click();
    expect(inputs()[1].value).toBe('7');
  });

  it('counts with the arrow keys too, and starts from 0 on an empty field', () => {
    typeIn(inputs()[0], '');
    inputs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(inputs()[0].value).toBe('0.5');
    inputs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(inputs()[0].value).toBe('0');
  });

  it('tells whoever listens about the new number, as typing does', () => {
    const before = fixture.componentInstance.seen.length;
    buttons(0)[0].click();
    expect(fixture.componentInstance.seen.length).toBe(before + 1);
    expect(fixture.componentInstance.seen.at(-1)).toBe('2.5');
  });

  it('has no buttons on a disabled field or one that asks for none', () => {
    expect(buttons(2)).toHaveLength(0);
    expect(buttons(3)).toHaveLength(0);
    expect(inputs()[2].disabled).toBe(true);
  });

  it('gives and clears the text through its reference', () => {
    const field = fixture.debugElement.children[0].componentInstance as NumberFieldComponent;
    expect(field.value).toBe('2');
    field.value = '';
    expect(inputs()[0].value).toBe('');
  });
});
