import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Lang } from './core/models';
import { NAV } from './app.routes';
import { I18nService } from './core/services/i18n.service';
import { ThemeService } from './core/services/theme.service';
import { UiService } from './core/services/ui.service';
import { DateU, dayShort, inputValue } from './core/utils';
import { AddMealDialog } from './features/dialogs/add-meal.dialog';
import { DayDetailDialog } from './features/dialogs/day-detail.dialog';
import { IconComponent } from './shared/icon.component';
import { OverlaysComponent } from './shared/overlays.component';
import { TPipe } from './shared/t.pipe';
import { t } from './core/i18n/translate';

@Component({
  selector: 'app-root',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, IconComponent, OverlaysComponent, AddMealDialog, DayDetailDialog, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-screen grid-cols-[232px_1fr] tablet:grid-cols-[minmax(0,1fr)]">
      <aside
        class="sticky top-0 flex h-screen flex-col gap-1.5 border-r border-border-soft bg-[linear-gradient(180deg,var(--color-sidebar-top),var(--color-bg))] px-3.5 py-[22px] tablet:hidden"
      >
        <a routerLink="/" class="flex items-center gap-2.5 px-2.5 pt-1 pb-5 text-[18px] font-extrabold tracking-[-.02em] text-inherit no-underline" [attr.aria-label]="'app.fitflowHomePage' | t">
          <div class="grid size-[34px] place-items-center rounded-[10px] bg-accent text-accent-ink"><app-icon name="dumbbell" /></div>
          {{ 'app.fitflow' | t }}
        </a>
        <nav class="flex flex-col gap-1.5">
          <ng-container *ngTemplateOutlet="navLinks; context: { bottom: false }" />
        </nav>
        <div class="mt-auto rounded-[12px] bg-surface p-3 text-[12px] text-muted"><b class="text-text">{{ 'app.naturalWay' | t }}</b><br />{{ 'app.buildMuscleKeepFat' | t }}</div>
      </aside>

      <main class="min-w-0 px-7 pt-[22px] pb-[90px] tablet:px-4 tablet:pt-4 tablet:pb-24">
        <header class="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-[22px] font-extrabold tracking-[-.02em]">{{ title() }}</h2>
            <div class="text-[13px] text-muted">{{ 'app.naturalMuscleGrowthAthletic' | t }}</div>
          </div>
          <div class="flex items-center gap-1.5 rounded-[12px] border border-border-soft bg-surface p-1">
            <button class="btn btn-ghost btn-icon" (click)="ui.shift(-1)" [attr.aria-label]="'app.previousDay' | t"><app-icon name="left" /></button>
            <span class="px-2.5 font-semibold whitespace-nowrap phone:px-1 phone:text-[13px]">{{ dateLabel() }}</span>
            <button class="btn btn-ghost btn-icon" (click)="ui.shift(1)" [attr.aria-label]="'app.nextDay' | t"><app-icon name="right" /></button>
            <button class="btn btn-sm" (click)="ui.goToday()">{{ 'app.today' | t }}</button>
            <select class="h-9 text-[13px] font-semibold" [value]="i18n.lang()" (change)="i18n.setLang(val($event))" [attr.aria-label]="'app.language' | t">
              @for (l of i18n.langs; track l.id) {
                <option [value]="l.id" [selected]="l.id === i18n.lang()">{{ l.label }}</option>
              }
            </select>
            <button
              class="btn btn-ghost btn-icon"
              (click)="theme.toggle()"
              [attr.aria-label]="theme.resolved() === 'dark' ? ('app.switchToLightMode' | t) : ('app.switchToDarkMode' | t)"
              [title]="theme.resolved() === 'dark' ? ('app.lightMode' | t) : ('app.darkMode' | t)"
            >
              <app-icon [name]="theme.resolved() === 'dark' ? 'sun' : 'moon'" />
            </button>
          </div>
        </header>
        <router-outlet />
      </main>
    </div>

    <nav
      class="fixed right-0 bottom-0 left-0 z-50 hidden overflow-x-auto border-t border-border-soft bg-bg/95 px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-[12px] tablet:flex"
    >
      <ng-container *ngTemplateOutlet="navLinks; context: { bottom: true }" />
    </nav>

    <ng-template #navLinks let-bottom="bottom">
      @for (n of nav; track n.path) {
        <a class="nav-btn" [class.nav-btn-bottom]="bottom" [routerLink]="n.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: n.path === '/' }">
          <app-icon [name]="n.icon" /><span>{{ n.label | t }}</span>
        </a>
      }
    </ng-template>

    @if (ui.addMealOpen()) {
      <app-add-meal-dialog />
    }
    @if (ui.detailDate(); as d) {
      <app-day-detail-dialog [date]="d" />
    }
    <app-overlays />
  `,
})
export class App {
  protected readonly nav = NAV;
  protected readonly ui = inject(UiService);
  protected readonly i18n = inject(I18nService);
  protected readonly val = (e: Event): Lang => inputValue(e) as Lang;
  protected readonly theme = inject(ThemeService); // also applies data-theme on <html>
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly title = computed(() => {
    const path = this.url().split('?')[0];
    return t((NAV.find((n) => n.path !== '/' && path.startsWith(n.path)) ?? NAV[0]).label);
  });

  protected readonly dateLabel = computed(() => {
    const k = this.ui.viewDate();
    return `${this.ui.isToday() ? `${t('app.today')} · ` : ''}${DateU.short(k)}, ${dayShort(DateU.dow(k) - 1)}`;
  });
}
