import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { FakeAuthService } from '../../core/auth/fake-auth.service';
import { FakeFoodRepository } from '../../core/repositories/fake-food.repository';
import { FoodRepository } from '../../core/repositories/food.repository';
import { FoodCatalogService } from '../../core/services/food-catalog.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { FoodReferencesPage } from './food-references.page';
import { ReferencesPage } from './references.page';

const render = async <T>(fixture: ComponentFixture<T>): Promise<void> => {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
};

describe('reference lists', () => {
  beforeAll(() => (Element.prototype.scrollIntoView ??= () => {}));

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useClass: FakeAuthService }, { provide: FoodRepository, useClass: FakeFoodRepository }] });
  });

  it('shows the index as a grid with the food database as its first card, linking to its own page', async () => {
    const fixture = TestBed.createComponent(ReferencesPage);
    await render(fixture);
    const cards = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('a.card'));
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('href')).toBe('/references/foods');
    expect(cards[0].textContent).toContain('Qida bazası');
    expect(cards[0].textContent).toContain(`${TestBed.inject(FoodCatalogService).entries().length} yazı`);
  });

  const signIn = async (): Promise<void> => {
    (TestBed.inject(AuthService) as FakeAuthService).stored = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, hasPassword: true };
    await TestBed.inject(AuthStore).init();
    await TestBed.inject(FoodCatalogService).refresh();
  };

  const rowsOf = (root: HTMLElement): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('tbody tr'));
  const type = (el: HTMLInputElement, value: string): void => {
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };
  const buttonWithLabel = (root: HTMLElement, label: string): HTMLButtonElement =>
    root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('asks a guest to sign in instead of showing the add form', async () => {
    await TestBed.inject(AuthStore).init();
    const fixture = TestBed.createComponent(FoodReferencesPage);
    await render(fixture);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('input[type=text]')).toHaveLength(1); // only the search box
    expect(root.querySelector('a[href="/auth/sign-in"]')).not.toBeNull();
    expect(rowsOf(root)).toHaveLength(10);
  });

  it('shows 10 foods per page with a total, and pages through the rest', async () => {
    const fixture = TestBed.createComponent(FoodReferencesPage);
    await render(fixture);
    const root: HTMLElement = fixture.nativeElement;
    const total = TestBed.inject(FoodCatalogService).entries().length;
    expect(rowsOf(root)).toHaveLength(10);
    expect(root.querySelector('.badge')!.textContent).toContain(String(total));
    expect(root.textContent).toContain(`1–10 / ${total}`);
    const first = rowsOf(root)[0].textContent;

    buttonWithLabel(root, 'Əvvəlki səhifə').click();
    await render(fixture);
    expect(root.textContent).toContain(`1–10 / ${total}`); // already on the first page
    buttonWithLabel(root, 'Növbəti səhifə').click();
    await render(fixture);
    expect(root.textContent).toContain(`11–20 / ${total}`);
    expect(rowsOf(root)[0].textContent).not.toBe(first);
  });

  it('searches only from 3 characters on, and goes back to the first page', async () => {
    const fixture = TestBed.createComponent(FoodReferencesPage);
    await render(fixture);
    const root: HTMLElement = fixture.nativeElement;
    const search = Array.from(root.querySelectorAll<HTMLInputElement>('input[type=text]')).at(-1)!;
    buttonWithLabel(root, 'Növbəti səhifə').click();
    await render(fixture);

    type(search, 'to');
    await render(fixture);
    expect(rowsOf(root)).toHaveLength(10); // too short: nothing is filtered
    expect(root.textContent).toContain('ən azı 3 simvol');

    type(search, 'toyuq');
    await render(fixture);
    const rows = rowsOf(root);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(10);
    expect(rows.every((r) => r.textContent!.toLowerCase().includes('toyuq'))).toBe(true);
    expect(root.textContent).not.toContain('ən azı 3 simvol');
  });

  it('lists the foods with system ones locked, and adds and deletes the signed-in user's own', async () => {
    await signIn();
    const fixture = TestBed.createComponent(FoodReferencesPage);
    await render(fixture);
    const root: HTMLElement = fixture.nativeElement;
    expect(rowsOf(root).every((r) => r.querySelector('button') === null)).toBe(true); // no delete on system rows
    expect(rowsOf(root)[0].textContent).toContain('Sistem');

    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[type=text]'));
    type(inputs[0], 'Süd kokteyli'); // name AZ
    type(inputs[3], '200'); // kcal
    fixture.detectChanges();
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Əlavə et'))!.click();
    await render(fixture);

    const search = Array.from(root.querySelectorAll<HTMLInputElement>('input[type=text]')).at(-1)!;
    type(search, 'kokteyli');
    await render(fixture);
    expect(rowsOf(root)).toHaveLength(1);
    const own = rowsOf(root)[0];
    expect(own.textContent).toContain('Süd kokteyli');
    expect(own.textContent).not.toContain('Sistem');

    const confirm = TestBed.inject(ConfirmService);
    own.querySelector('button')!.click();
    confirm.answer(true);
    await render(fixture);
    await render(fixture);
    expect(rowsOf(root)).toHaveLength(0);
  });
});
