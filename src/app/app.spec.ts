import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { FakeAuthService } from './core/auth/fake-auth.service';
import { AuthStore } from './core/auth/auth.store';
import { StoreService } from './core/services/store.service';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: AuthService, useClass: FakeAuthService }],
    }).compileComponents();
  });

  it('renders the navigation and date controls', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('aside a.nav-btn').length).toBe(8);
    expect(el.querySelector('[aria-label="Əvvəlki gün"]')?.parentElement?.textContent).toContain('Bugün');
  });

  it('does not block a guest with the height and weight dialog', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(TestBed.inject(StoreService).bodyBasicsKnown()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-body-basics-dialog')).toBeNull();
  });

  it('asks a signed-in user for height, weight, age and sex until all are entered, and then goes away', async () => {
    (TestBed.inject(AuthService) as FakeAuthService).stored = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, hasPassword: true };
    await TestBed.inject(AuthStore).init();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const store = TestBed.inject(StoreService);
    expect(store.settings().height).toBeNull();
    expect(el.querySelector('app-body-basics-dialog [role=dialog]')).not.toBeNull();
    expect(el.querySelector('app-body-basics-dialog [aria-label="Bağla"]')).toBeNull(); // cannot be closed

    const [h, w, a] = Array.from(el.querySelectorAll<HTMLInputElement>('app-body-basics-dialog input'));
    const type = (i: HTMLInputElement, v: string): void => {
      i.value = v;
      i.dispatchEvent(new Event('input'));
    };
    type(h, '20'); // out of range: stays open
    type(w, '80');
    type(a, '30');
    el.querySelector<HTMLButtonElement>('app-body-basics-dialog [role=radio]')!.click(); // male
    Array.from(el.querySelectorAll<HTMLButtonElement>('app-body-basics-dialog button')).find((b) => b.textContent?.includes('Yadda saxla'))!.click();
    fixture.detectChanges();
    expect(store.bodyBasicsKnown()).toBe(false);

    type(h, '178');
    Array.from(el.querySelectorAll<HTMLButtonElement>('app-body-basics-dialog button')).find((b) => b.textContent?.includes('Yadda saxla'))!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(store.settings()).toMatchObject({ height: 178, startWeight: 80, age: 30, sex: 'male' });
    expect(el.querySelector('app-body-basics-dialog')).toBeNull();
  });
});
