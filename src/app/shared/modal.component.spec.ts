import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal.component';

@Component({ imports: [ModalComponent], template: `<app-modal heading="Test">Body</app-modal>` })
class Host {}

describe('ModalComponent page scroll', () => {
  const body = document.body;

  it('hides the page scrollbar while open and restores it after the last modal closes', () => {
    const first = TestBed.createComponent(Host);
    expect(body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe(''); // <html> untouched: the sticky sidebar stays on screen

    const stacked = TestBed.createComponent(Host); // e.g. confirm over a dialog
    first.destroy();
    expect(body.style.overflow).toBe('hidden');

    stacked.destroy();
    expect(body.style.overflow).toBe('');
    expect(body.style.paddingRight).toBe('');
  });
});
