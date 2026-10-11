import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { FakeAuthService } from '../../core/auth/fake-auth.service';
import { contentNames } from '../../core/i18n/translate';
import { systemMealTemplates } from '../../core/meal-book';
import { FakeFoodRepository } from '../../core/repositories/fake-food.repository';
import { FakeMealRepository } from '../../core/repositories/fake-meal.repository';
import { FoodRepository } from '../../core/repositories/food.repository';
import { MealRepository } from '../../core/repositories/meal.repository';
import { MealCatalogService } from '../../core/services/meal-catalog.service';
import { MealReferencesPage } from './meal-references.page';

const render = async <T>(fixture: ComponentFixture<T>): Promise<void> => {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
};

const USER = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, settings: null, roleId: 'user', hasPassword: true };

describe('MealReferencesPage', () => {
  beforeAll(() => (Element.prototype.scrollIntoView ??= () => {}));

  beforeEach(() => {
    localStorage.clear();
    systemMealTemplates.set([]);
    contentNames.set(new Map());
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useClass: FakeAuthService }, { provide: FoodRepository, useClass: FakeFoodRepository }, { provide: MealRepository, useClass: FakeMealRepository }],
    });
  });

  afterEach(() => {
    systemMealTemplates.set([]);
    contentNames.set(new Map());
  });

  const signIn = async (permissions: string[] | null): Promise<void> => {
    (TestBed.inject(AuthService) as FakeAuthService).stored = { ...USER, permissions, avatar: null, height: null, startWeight: null, age: null, sex: null };
    await TestBed.inject(AuthStore).init();
  };

  it('lists the templates read-only for a guest, without the add form', async () => {
    await TestBed.inject(AuthStore).init();
    const fixture = TestBed.createComponent(MealReferencesPage);
    await render(fixture);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('tbody tr')).toHaveLength(10); // one page
    expect(root.querySelector('.alert-info')).not.toBeNull();
    expect(root.querySelector('button[aria-label^="Dəyiş"]')).toBeNull();
    expect(root.textContent).not.toContain('Yeni yemək əlavə et');
  });

  it('pages through the templates with the shared pagination, and filters by meal and by name', async () => {
    await TestBed.inject(AuthStore).init();
    const fixture = TestBed.createComponent(MealReferencesPage);
    await render(fixture);
    const root: HTMLElement = fixture.nativeElement;
    const total = TestBed.inject(MealCatalogService).entries().length;
    const rows = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('tbody tr'));
    expect(root.querySelector('.badge')!.textContent).toContain(String(total));
    expect(root.textContent).toContain(`1–10 / ${total}`);
    const first = rows()[0].textContent;
    root.querySelector<HTMLButtonElement>('button[aria-label="Növbəti səhifə"]')!.click();
    await render(fixture);
    expect(root.textContent).toContain(`11–20 / ${total}`);
    expect(rows()[0].textContent).not.toBe(first);

    const search = root.querySelector<HTMLInputElement>('input[type=text]')!;
    search.value = 'tuna';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await render(fixture);
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().length).toBeLessThan(10);
    for (const r of rows()) expect(r.textContent!.toLowerCase()).toContain('tuna');
    expect(root.textContent).toContain('1–');
  });

  it('shows the add form and the row buttons to a role that holds meals.edit', async () => {
    await signIn(['references.view', 'meals.edit']);
    const fixture = TestBed.createComponent(MealReferencesPage);
    await render(fixture);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Yeni yemək əlavə et');
    expect(root.querySelector('.alert-info')).toBeNull();
    expect(root.querySelector('button[aria-label^="Dəyiş"]')).not.toBeNull();
  });

  it('keeps the form away from a role without meals.edit', async () => {
    await signIn(['references.view', 'references.edit']);
    const fixture = TestBed.createComponent(MealReferencesPage);
    await render(fixture);
    expect(fixture.nativeElement.textContent).not.toContain('Yeni yemək əlavə et');
  });
});
