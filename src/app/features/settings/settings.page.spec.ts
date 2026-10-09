import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FakeAuthService } from '../../core/auth/fake-auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { StoreService } from '../../core/services/store.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage required fields', () => {
  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useClass: FakeAuthService }] });
    await TestBed.inject(AuthStore).init(); // a guest: until the session is checked, nothing is saved to an account
    TestBed.inject(StoreService).mutate((s) => {
      s.settings.height = 180;
      s.settings.startWeight = 80;
      s.settings.age = 30;
      s.settings.sex = 'male';
      s.settings.targetMode = 'custom'; // most tests here are about typed numbers
    });
  });

  const open = async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const field = (label: string): HTMLInputElement => Array.from(root.querySelectorAll('.field')).find((l) => l.textContent?.includes(label))!.querySelector('input')!;
    const type = (el: HTMLInputElement, v: string): void => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    };
    const save = async (): Promise<void> => {
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Yadda saxla'))!.click();
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve)); // saving waits for the account first (also as a guest): let its promises finish
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

  it('suggests calories and protein from the body data and the goal, and applies them only when asked', async () => {
    const { root, save } = await open();
    expect(root.textContent).toContain('Təklif olunan hədəf');
    expect(root.textContent).toContain('2760 kkal'); // 80 kg, 180 cm, 30 y, male, maintain: 1780 × 1.55 = 2759, rounded to 2760
    const store = TestBed.inject(StoreService);
    expect(store.settings().kcalTarget).toBe(2700); // nothing applied yet

    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Hədəfləri tətbiq et'))!.click();
    await save();
    expect(store.settings().kcalTarget).toBe(2760);
    expect(store.settings().proteinTarget).toBe(145);
  });

  it('asks for the age and the sex like any other required field', async () => {
    TestBed.inject(StoreService).mutate((s) => (s.settings.sex = null));
    const { root, save } = await open();
    await save();
    expect(root.textContent).toContain('Bu xana mütləqdir');
  });

  it('gives no target suggestion to a minor or to a dangerously low BMI, only a warning', async () => {
    TestBed.inject(StoreService).mutate((s) => Object.assign(s.settings, { height: 150, startWeight: 30, age: 15, sex: 'female' }));
    const { root } = await open();
    expect(root.textContent).not.toContain('Hədəfləri tətbiq et');
    expect(root.textContent).toContain('18 yaşdan yuxarılar üçündür');
  });

  it('shows automatic targets in disabled fields, without an apply button', async () => {
    TestBed.inject(StoreService).mutate((s) => (s.settings.targetMode = 'auto'));
    const { root, field } = await open();
    expect(field('Kalori hədəfi').disabled).toBe(true);
    expect(field('Kalori hədəfi').value).toBe('2760');
    expect(root.textContent).toContain('Hədəflər avtomatik hesablanır');
    expect(Array.from(root.querySelectorAll('button')).some((b) => b.textContent?.includes('Hədəfləri tətbiq et'))).toBe(false);
  });

  it('refuses a height and weight that cannot be one person, even though each is inside its own range', async () => {
    const { root, field, type, save } = await open();
    type(field('Boy'), '100');
    type(field('Başlanğıc çəki'), '300');
    await save();
    expect(TestBed.inject(StoreService).settings()).toMatchObject({ height: 180, startWeight: 80 }); // nothing saved
    expect(root.textContent).toContain('bir-birinə uyğun gəlmir');
    expect(root.textContent).not.toContain('Təklif olunan hədəf'); // and no target is suggested for it
    expect(root.textContent).not.toContain('Hədəflər avtomatik hesablanır');
  });

  it('shows the newest logged weight as the current weight, and the checks use it instead of the starting weight', async () => {
    const store = TestBed.inject(StoreService);
    store.mutate((s) => s.weights.push({ date: '2026-01-01', kg: 50, waist: null }));
    const { root, field, type, save } = await open();
    expect(field('Cari çəki').value).toBe('50');
    expect(field('Cari çəki').disabled).toBe(true);
    type(field('Başlanğıc çəki'), '100');
    await save();
    expect(store.settings().startWeight).toBe(100);
    expect(store.currentWeight()).toBe(50); // the log still wins; the starting weight is only the fallback
    expect(store.state().weights).toHaveLength(1); // saving the starting weight does not write a weight entry
    expect(root.textContent).toContain('Cari çəki');
  });
});
