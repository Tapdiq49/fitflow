import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CORNERS, Corners, DATE_FORMATS, DateFormat, Direction, FONT_SCALES, FontScale, NAV_LAYOUTS, NavLayout, SKINS, SkinId, Settings, TIME_FORMATS, TimeFormat } from '../../common/interfaces';
import { activeDateFormat, activeTimeFormat } from '../utils';
import { DEFAULT_SETTINGS } from './store.service';
import { StoreService } from './store.service';

const QUERY = '(prefers-color-scheme: light)';
const THEME_COLOR = { light: '#f3f5f8', dark: '#0a0e13' };

/** Resolves the theme setting ("system" follows the OS) and the color skin and applies them as data-theme / data-skin / dir / font / corners / contrast on <html>, and the clock and date formats for fmtTime / DateU. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly store = inject(StoreService);
  private readonly systemLight = signal(typeof matchMedia === 'function' && matchMedia(QUERY).matches);

  readonly resolved = computed<'light' | 'dark'>(() => {
    const t = this.store.settings().theme;
    return t === 'system' ? (this.systemLight() ? 'light' : 'dark') : t;
  });

  /** The saved skin; an unknown value (older or newer backend data) falls back to the default one. */
  readonly skin = computed<SkinId>(() => {
    const s = this.store.settings().skin;
    return SKINS.includes(s) ? s : 'lime';
  });

  /** Saved text direction and navigation layout; unknown values from the account fall back to the defaults. */
  readonly dir = computed<Direction>(() => (this.store.settings().dir === 'rtl' ? 'rtl' : 'ltr'));
  readonly layout = computed<NavLayout>(() => {
    const l = this.store.settings().navLayout;
    return NAV_LAYOUTS.includes(l) ? l : 'side';
  });

  /** Display options; an unknown value (older or newer backend data) falls back to the default. */
  readonly fontScale = computed<FontScale>(() => this.pick(FONT_SCALES, this.store.settings().fontScale, 'md'));
  readonly corners = computed<Corners>(() => this.pick(CORNERS, this.store.settings().corners, 'medium'));
  readonly highContrast = computed(() => this.store.settings().highContrast === true);
  readonly timeFormat = computed<TimeFormat>(() => this.pick(TIME_FORMATS, this.store.settings().timeFormat, '24h'));
  readonly dateFormat = computed<DateFormat>(() => this.pick(DATE_FORMATS, this.store.settings().dateFormat, 'text'));

  private pick<T extends string>(list: readonly T[], v: T, fallback: T): T {
    return list.includes(v) ? v : fallback;
  }

  /** Switches between light and dark; the choice is saved as an explicit theme. */
  toggle(): void {
    const next = this.resolved() === 'dark' ? 'light' : 'dark';
    this.store.mutate((s) => (s.settings.theme = next));
  }

  setSkin(skin: SkinId): void {
    this.store.mutate((s) => (s.settings.skin = skin));
  }

  /** Saves one display option. */
  set<K extends 'fontScale' | 'corners' | 'highContrast' | 'timeFormat' | 'dateFormat'>(key: K, value: Settings[K]): void {
    this.store.mutate((s) => (s.settings[key] = value));
  }

  /** Puts every look option (theme, skin, direction, layout, sidebar, text size, corners, contrast, clock and date format) back to its default. */
  resetDisplay(): void {
    const { theme, skin, dir, navLayout, sidebarCollapsed, fontScale, corners, highContrast, timeFormat, dateFormat } = DEFAULT_SETTINGS;
    this.store.mutate((s) => Object.assign(s.settings, { theme, skin, dir, navLayout, sidebarCollapsed, fontScale, corners, highContrast, timeFormat, dateFormat }));
  }

  setDir(dir: Direction): void {
    this.store.mutate((s) => (s.settings.dir = dir));
  }

  setLayout(layout: NavLayout): void {
    this.store.mutate((s) => (s.settings.navLayout = layout));
  }

  constructor() {
    if (typeof matchMedia === 'function') matchMedia(QUERY).addEventListener('change', (e) => this.systemLight.set(e.matches));
    effect(() => {
      const r = this.resolved();
      document.documentElement.setAttribute('data-theme', r);
      document.documentElement.setAttribute('data-skin', this.skin());
      document.documentElement.setAttribute('dir', this.dir());
      document.documentElement.setAttribute('data-font', this.fontScale());
      document.documentElement.setAttribute('data-corners', this.corners());
      if (this.highContrast()) document.documentElement.setAttribute('data-contrast', 'high');
      else document.documentElement.removeAttribute('data-contrast');
      activeTimeFormat.set(this.timeFormat());
      activeDateFormat.set(this.dateFormat());
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[r]);
    });
  }
}
