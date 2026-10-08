import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, ElementRef, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from './core/auth/auth.store';
import { Lang } from './common/interfaces';
import { NAV } from './app.routes';
import { I18nService } from './core/services/i18n.service';
import { ThemeService } from './core/services/theme.service';
import { UiService } from './core/services/ui.service';
import { DateU, dayName, dayShort } from './core/utils';
import { AddMealDialog } from './features/dialogs/add-meal.dialog';
import { DayDetailDialog } from './features/dialogs/day-detail.dialog';
import { BodyBasicsDialog } from './features/profile/body-basics.dialog';
import { StoreService } from './core/services/store.service';
import { GuestNoticeComponent } from './features/auth/guest-notice.component';
import { UserMenuComponent } from './features/auth/user-menu.component';
import { DisplaySettingsComponent } from './features/appearance/display-settings.component';
import { SelectComponent } from './shared/forms/select.component';
import type { SelectOption } from './shared/forms/select.component';
import { IconComponent } from './shared/icon/icon.component';
import { OverlaysComponent } from './shared/overlays/overlays.component';
import { TPipe } from './common/pipes/translate/t.pipe';
import { t } from './core/i18n/translate';

@Component({
  selector: 'app-root',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, IconComponent, SelectComponent, OverlaysComponent, AddMealDialog, DayDetailDialog, BodyBasicsDialog, GuestNoticeComponent, UserMenuComponent, DisplaySettingsComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- On /auth pages the shell is only hidden, never removed: destroying the half-loaded deferred language select throws. -->
    <div
      class="grid min-h-screen grid-cols-[232px_1fr] data-[collapsed=true]:grid-cols-[72px_1fr] tablet:grid-cols-[minmax(0,1fr)] tablet:data-[collapsed=true]:grid-cols-[minmax(0,1fr)] data-[layout=top]:grid-cols-[minmax(0,1fr)] data-[layout=dock]:grid-cols-[minmax(0,1fr)]"
      [attr.data-collapsed]="ui.sidebarCollapsed()"
      [attr.data-layout]="theme.layout()"
      [style.display]="isAuthPage() ? 'block' : null"
    >
      <aside [style.display]="sidebarShown() ? null : 'none'" [class]="asideClass()">
        <a routerLink="/" class="flex items-center gap-2.5 pt-1 pb-5 text-[1.125rem] font-extrabold tracking-[-.02em] text-inherit no-underline" [class]="ui.sidebarCollapsed() ? 'justify-center' : 'px-2.5'" [attr.aria-label]="'app.fitflowHomePage' | t">
          <div class="grid size-[34px] shrink-0 place-items-center rounded-[calc(var(--r)_*_10px)] bg-accent text-accent-ink"><app-icon name="dumbbell" /></div>
          @if (!ui.sidebarCollapsed()) {
            {{ 'app.fitflow' | t }}
          }
        </a>
        <nav class="flex flex-col gap-1.5">
          <ng-container *ngTemplateOutlet="navLinks; context: { bottom: false, rail: ui.sidebarCollapsed() }" />
        </nav>
        @if (!ui.sidebarCollapsed()) {
          <div class="mt-auto rounded-[calc(var(--r)_*_12px)] bg-surface p-3 text-[0.75rem] text-muted"><b class="text-text">{{ 'app.naturalWay' | t }}</b><br />{{ 'app.buildMuscleKeepFat' | t }}</div>
        }
      </aside>

      <main class="min-w-0 px-7 pb-[90px] tablet:px-4 tablet:pb-24" [style.padding]="isAuthPage() ? '0' : null">
        @if (!isAuthPage()) {
          <app-guest-notice />
        }
        <!-- Sticky on every page; its height is published as --header-h for sticky bars below it (workout page). -->
        <header
          #header
          [style.display]="isAuthPage() ? 'none' : null"
          class="sticky top-0 z-40 -mx-7 mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border-soft bg-bg/92 px-7 pt-[22px] pb-3 backdrop-blur-[10px] tablet:-mx-4 tablet:px-4 tablet:pt-4"
        >
          <div class="flex items-center gap-3">
            @if (sidebarShown()) {
            <button
              class="btn btn-ghost btn-icon tablet:hidden"
              (click)="ui.toggleSidebar()"
              [attr.aria-label]="ui.sidebarCollapsed() ? ('app.openSidebar' | t) : ('app.closeSidebar' | t)"
              [attr.aria-expanded]="!ui.sidebarCollapsed()"
              [title]="ui.sidebarCollapsed() ? ('app.openSidebar' | t) : ('app.closeSidebar' | t)"
            >
              <app-icon name="sidebar" />
            </button>
            }
            <div>
              <h2 class="text-[1.375rem] font-extrabold tracking-[-.02em]">{{ title() }}</h2>
              <div class="text-[0.8125rem] text-muted">{{ 'app.naturalMuscleGrowthAthletic' | t }}</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 rounded-[calc(var(--r)_*_12px)] border border-border-soft bg-surface p-1">
            <button class="btn btn-ghost btn-icon" (click)="ui.shift(-1)" [attr.aria-label]="'app.previousDay' | t"><app-icon name="left" /></button>
            <span class="px-2.5 font-semibold whitespace-nowrap phone:px-1 phone:text-[0.8125rem]">{{ dateLabel() }}</span>
            <button class="btn btn-ghost btn-icon" (click)="ui.shift(1)" [attr.aria-label]="'app.nextDay' | t"><app-icon name="right" /></button>
            <button class="btn btn-sm" (click)="ui.goToday()">{{ 'app.today' | t }}</button>
            <!-- Deferred: the dropdown (Aria + CDK overlay) stays out of the initial bundle. -->
            @defer (on idle) {
              <app-select class="w-[4.875rem] [&_[role=combobox]]:h-9 [&_[role=combobox]]:text-[0.8125rem] [&_[role=combobox]]:font-semibold" [label]="'app.language' | t" [options]="langOptions" [value]="i18n.lang()" (valueChange)="i18n.setLang($event)" />
            } @placeholder {
              <span class="grid h-9 w-[4.875rem] place-items-center rounded-[calc(var(--r)_*_9px)] border border-border text-[0.8125rem] font-semibold">{{ i18n.lang().toUpperCase() }}</span>
            }
            <button
              class="btn btn-ghost btn-icon"
              (click)="theme.toggle()"
              [attr.aria-label]="theme.resolved() === 'dark' ? ('app.switchToLightMode' | t) : ('app.switchToDarkMode' | t)"
              [title]="theme.resolved() === 'dark' ? ('app.lightMode' | t) : ('app.darkMode' | t)"
            >
              <app-icon [name]="theme.resolved() === 'dark' ? 'sun' : 'moon'" />
            </button>
            <!-- Deferred: CDK overlay stays out of the initial bundle. -->
            @defer (on idle) {
              <app-display-settings />
            } @placeholder {
              <span class="size-9"></span>
            }
            @if (auth.user()) {
              <!-- Deferred: CDK menu stays out of the initial bundle. -->
              @defer (on idle) {
                <app-user-menu />
              } @placeholder {
                <span class="size-9 rounded-full bg-accent"></span>
              }
            } @else if (auth.status() === 'loading') {
              <span class="spinner mx-2 text-muted" aria-hidden="true"></span>
            } @else if (auth.isGuest()) {
              <a class="btn btn-sm btn-primary" routerLink="/auth/sign-in">{{ 'auth.signIn' | t }}</a>
            }
          </div>
        </header>
        @if (theme.layout() === 'top' && !isAuthPage()) {
          <nav class="mb-5 flex items-center gap-1.5 overflow-x-auto border-b border-border-soft pb-3 tablet:hidden">
            <ng-container *ngTemplateOutlet="navLinks; context: { bottom: false, rail: false }" />
          </nav>
        }
        <router-outlet />
      </main>
    </div>

    @if (theme.layout() === 'dock' && !isAuthPage()) {
      <nav class="fixed start-1/2 bottom-4 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-[calc(var(--r)_*_18px)] border border-border bg-surface/95 p-1.5 shadow-card backdrop-blur-[12px] rtl:translate-x-1/2 tablet:hidden">
        <ng-container *ngTemplateOutlet="navLinks; context: { bottom: true, rail: false }" />
      </nav>
    }

    <nav
      [style.display]="isAuthPage() ? 'none' : null"
      class="fixed right-0 bottom-0 left-0 z-50 hidden overflow-x-auto border-t border-border-soft bg-bg/95 px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-[12px] tablet:flex"
    >
      <ng-container *ngTemplateOutlet="navLinks; context: { bottom: true, rail: false }" />
    </nav>

    <ng-template #navLinks let-bottom="bottom" let-rail="rail">
      @for (n of nav; track n.path) {
        <a
          class="nav-btn"
          [class.nav-btn-bottom]="bottom"
          [class.justify-center]="rail"
          [attr.title]="rail ? (n.label | t) : null"
          [attr.aria-label]="rail ? (n.label | t) : null"
          [routerLink]="n.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: n.path === '/' }"
        >
          <app-icon [name]="n.icon" />@if (!rail) {
            <span>{{ n.label | t }}</span>
          }
        </a>
      }
    </ng-template>

    <!-- Deferred with its form controls (Aria + CDK overlay); fetched in the background once the page is idle. -->
    @defer (when ui.addMealOpen(); prefetch on idle) {
      @if (ui.addMealOpen()) {
        <app-add-meal-dialog />
      }
    }
    <!-- Deferred like the add-meal dialog: only opened from the calendar and the weekly card. -->
    @defer (when ui.detailDate(); prefetch on idle) {
      @if (ui.detailDate(); as d) {
        <app-day-detail-dialog [date]="d" />
      }
    }
    @if (auth.user() && auth.user()?.height == null && !isAuthPage() && !store.bodyBasicsKnown()) {
      <app-body-basics-dialog />
    }
    <app-overlays />
  `,
})
export class App {
  protected readonly nav = NAV;
  protected readonly ui = inject(UiService);
  protected readonly i18n = inject(I18nService);
  protected readonly langOptions: SelectOption<Lang>[] = this.i18n.langs.map((l) => ({ value: l.id, label: l.label }));
  protected readonly theme = inject(ThemeService); // also applies data-theme and data-skin on <html>
  /** Classic and floating layouts have the sidebar; top and dock replace it. */
  protected readonly sidebarShown = computed(() => !this.isAuthPage() && (this.theme.layout() === 'side' || this.theme.layout() === 'floating'));
  protected readonly asideClass = computed(() => {
    const pad = this.ui.sidebarCollapsed() ? 'px-2.5' : 'px-3.5';
    const base = 'sticky flex flex-col gap-1.5 overflow-x-hidden py-[22px] tablet:hidden ' + pad;
    return this.theme.layout() === 'floating'
      ? base + ' top-3 m-3 h-[calc(100vh-24px)] rounded-[calc(var(--r)_*_18px)] border border-border bg-surface shadow-card'
      : base + ' top-0 h-screen border-e border-border-soft bg-[linear-gradient(180deg,var(--color-sidebar-top),var(--color-bg))]';
  });
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  protected readonly auth = inject(AuthStore);
  protected readonly store = inject(StoreService);
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');

  constructor() {
    const root = inject(DOCUMENT).documentElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const el = this.header().nativeElement;
      const ro = new ResizeObserver(() => root.style.setProperty('--header-h', `${el.offsetHeight}px`));
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    // Before the first navigation ends, router.url is still "/" — the browser's address says whether this is an /auth page.
    { initialValue: this.location.path() },
  );

  /** Sign-in, sign-up and the other /auth pages are full-screen, without the app shell. */
  protected readonly isAuthPage = computed(() => this.url().split('?')[0].startsWith('/auth'));

  /** Page name; on the day overview it follows the viewed day: "Today · Wednesday, 7 Oct", or "Friday, 9 Oct" further away. */
  protected readonly title = computed(() => {
    const path = this.url().split('?')[0];
    const page = NAV.find((n) => n.path !== '/' && path.startsWith(n.path));
    if (page) return t(page.label);
    if (path.startsWith('/profile')) return t('profile.title');
    const k = this.ui.viewDate();
    const day = `${dayName(DateU.dow(k) - 1)}, ${DateU.short(k)}`;
    const relative = ({ [-1]: 'app.yesterday', 0: 'app.today', 1: 'app.tomorrow' } as Record<number, string>)[DateU.diffDays(this.ui.today(), k)];
    return relative ? `${t(relative)} · ${day}` : day;
  });

  protected readonly dateLabel = computed(() => {
    const k = this.ui.viewDate();
    return `${this.ui.isToday() ? `${t('app.today')} · ` : ''}${DateU.short(k)}, ${dayShort(DateU.dow(k) - 1)}`;
  });
}
