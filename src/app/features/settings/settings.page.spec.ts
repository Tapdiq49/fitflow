import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FakeAuthService } from '../../core/auth/fake-auth.service';
import { StoreService } from '../../core/services/store.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage required fields', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useClass: FakeAuthService }] });
    TestBed.inject(StoreService).mutate((s) => {
      s.settings.height = 180;
      s.settings.startWeight = 80;
    });
  });

  const open = async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const field = (label: string): HTMLInputElement => Array.from(root.querySelectorAll('label.field')).find((l) => l.textContent?.includes(label))!.querySelector('input')!;
    const type = (el: HTMLInputElement, v: string): void => {
      el.value = v;
      el.dispatchEvent(new Event('input'));
    };
    const save = async (): Promise<void> => {
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Yadda saxla'))!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { root, field, type, save };
  };

  it('reports an out-of-range height instead of changing it to the nearest allowed value', async () => {
    const { root, field, type, save } = await open();
    type(field('Boy'), '1');
    await save();
    expect(TestBed.inject(StoreService).settings().height).toBe(180); // nothing was saved
    expect(field('Boy').getAttribute('aria-invalid')).toBe('true');
    expect(root.textContent).toContain('100–250');
  });

  it('reports an emptied required field, and clears the message once it is fixed', async () => {
    const { root, field, type, save } = await open();
    type(field('Boy'), '');
    await save();
    expect(TestBed.inject(StoreService).settings().height).toBe(180);
    expect(root.textContent).toContain('Bu xana mütləqdir');

    type(field('Boy'), '175');
    expect(field('Boy').getAttribute('aria-invalid')).toBeNull();
    await save();
    expect(TestBed.inject(StoreService).settings().height).toBe(175);
  });

  it('takes the standard target when a target is left empty, but still reports an out-of-range one', async () => {
    TestBed.inject(StoreService).mutate((s) => (s.settings.proteinTarget = 150));
    const { root, field, type, save } = await open();
    type(field('Protein hədəfi'), '');
    await save();
    expect(TestBed.inject(StoreService).settings().proteinTarget).toBe(180); // emptied: the standard, not the old 150
    expect(root.textContent).not.toContain('Bu xana mütləqdir');

    type(field('Protein hədəfi'), '20');
    await save();
    expect(TestBed.inject(StoreService).settings().proteinTarget).toBe(180);
    expect(root.textContent).toContain('80–300');
  });
});
