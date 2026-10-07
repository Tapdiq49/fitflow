import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { FakeAuthService } from './core/auth/fake-auth.service';

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
});
