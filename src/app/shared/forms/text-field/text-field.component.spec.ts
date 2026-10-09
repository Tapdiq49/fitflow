import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextFieldComponent } from './text-field.component';

@Component({
  imports: [TextFieldComponent],
  template: `
    <app-text-field #name class="flex-1" width="9rem" inputClass="text-center" maxlength="60" [value]="text()" [placeholder]="'Ad'" [label]="'Ad'" [invalid]="bad()" (input)="text.set($any($event.target).value)" (focusout)="left.set(left() + 1)" />
    <app-text-field type="password" name="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" />
    <app-text-field inputmode="email" />
    <app-text-field disabled value="Bağlı" />
  `,
})
class HostComponent {
  readonly text = signal('Yumurta');
  readonly bad = signal(false);
  readonly left = signal(0);
}

describe('TextFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const inputs = (): HTMLInputElement[] => Array.from(fixture.nativeElement.querySelectorAll('input'));

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('wraps one native input per field and shows the value, the placeholder and the accessible name', () => {
    expect(inputs()).toHaveLength(4);
    const [name] = inputs();
    expect(name.value).toBe('Yumurta');
    expect(name.placeholder).toBe('Ad');
    expect(name.getAttribute('aria-label')).toBe('Ad');
    expect(name.getAttribute('maxlength')).toBe('60');
    expect(name.getAttribute('type')).toBe('text');
  });

  it('passes the type and the attributes a browser needs (password managers, no auto-capitals, no spell check)', () => {
    const [, password] = inputs();
    expect(password.type).toBe('password');
    expect(password.getAttribute('name')).toBe('password');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
    expect(password.getAttribute('autocapitalize')).toBe('none');
    expect(password.getAttribute('spellcheck')).toBe('false');
  });

  it('leaves out the attributes that were not given', () => {
    const [, password, email] = inputs();
    expect(email.getAttribute('name')).toBeNull();
    expect(email.getAttribute('autocomplete')).toBeNull();
    expect(email.getAttribute('maxlength')).toBeNull();
    expect(email.getAttribute('aria-label')).toBeNull();
    expect(password.getAttribute('aria-invalid')).toBeNull();
  });

  it('can ask for the e-mail keyboard of a phone and be disabled', () => {
    const [, , email, disabled] = inputs();
    expect(email.getAttribute('inputmode')).toBe('email');
    expect(disabled.disabled).toBe(true);
    expect(disabled.value).toBe('Bağlı');
  });

  it('takes the size and the layout on the element, the alignment on the input', () => {
    const host: HTMLElement = fixture.nativeElement.querySelector('app-text-field');
    expect(host.style.width).toBe('9rem');
    expect(host.className).toContain('flex-1');
    expect(inputs()[0].className).toContain('text-center');
    expect(inputs()[0].className).toContain('w-full');
  });

  it('marks a wrong value for the browser and the screen reader', () => {
    const [name] = inputs();
    expect(name.getAttribute('aria-invalid')).toBeNull();
    fixture.componentInstance.bad.set(true);
    fixture.detectChanges();
    expect(name.getAttribute('aria-invalid')).toBe('true');
  });

  it('lets the events of the input reach the element: typing, and leaving the field (focusout, blur does not bubble)', () => {
    const [name] = inputs();
    name.value = 'Badam';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.text()).toBe('Badam');
    name.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(fixture.componentInstance.left()).toBe(1);
  });

  it('follows a changed value, and gives and clears the text through its reference', () => {
    fixture.componentInstance.text.set('Süd');
    fixture.detectChanges();
    expect(inputs()[0].value).toBe('Süd');
    const field = fixture.debugElement.children[0].componentInstance as TextFieldComponent;
    expect(field.value).toBe('Süd');
    field.value = '';
    expect(inputs()[0].value).toBe('');
  });
});
