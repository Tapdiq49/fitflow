import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SKINS, SkinId } from '../../common/interfaces';
import { StoreService } from './store.service';

const QUERY = '(prefers-color-scheme: light)';
const THEME_COLOR = { light: '#f3f5f8', dark: '#0a0e13' };

/** Resolves the theme setting ("system" follows the OS) and the color skin and applies them as data-theme / data-skin on <html>. */
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

  /** Switches between light and dark; the choice is saved as an explicit theme. */
  toggle(): void {
    const next = this.resolved() === 'dark' ? 'light' : 'dark';
    this.store.mutate((s) => (s.settings.theme = next));
  }

  setSkin(skin: SkinId): void {
    this.store.mutate((s) => (s.settings.skin = skin));
  }

  constructor() {
    if (typeof matchMedia === 'function') matchMedia(QUERY).addEventListener('change', (e) => this.systemLight.set(e.matches));
    effect(() => {
      const r = this.resolved();
      document.documentElement.setAttribute('data-theme', r);
      document.documentElement.setAttribute('data-skin', this.skin());
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[r]);
    });
  }
}
