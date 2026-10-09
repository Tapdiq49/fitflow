import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CheckboxComponent } from './checkbox.component';

@Component({
  imports: [CheckboxComponent],
  template: `<app-checkbox [(checked)]="on" [disabled]="off()">Label</app-checkbox>`,
})
class Host {
  readonly on = signal(false);
  readonly off = signal(false);
}

describe('CheckboxComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    return { fixture, input };
  };

  it('toggles the bound value when clicked and shows the label', () => {
    const { fixture, input } = setup();
    expect(fixture.nativeElement.textContent).toContain('Label');
    input.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.on()).toBe(true);
    expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();
    input.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.on()).toBe(false);
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('does not change while disabled', () => {
    const { fixture, input } = setup();
    fixture.componentInstance.off.set(true);
    fixture.detectChanges();
    input.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.on()).toBe(false);
  });
});
