import { Injectable, effect, inject, untracked } from '@angular/core';
import { loadLang } from '../i18n/translate';
import { Lang } from '../models';
import { activeLang } from '../utils';
import { StoreService } from './store.service';

/** Keeps the active UI language in sync with the saved setting and exposes the switch. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly store = inject(StoreService);
  readonly lang = activeLang.asReadonly();
  readonly langs: ReadonlyArray<{ id: Lang; label: string }> = [
    { id: 'az', label: 'AZ' },
    { id: 'en', label: 'EN' },
    { id: 'ru', label: 'RU' },
  ];

  constructor() {
    activeLang.set(this.store.settings().lang);
    effect(() => {
      const l = this.store.settings().lang;
      // The texts of the language come first (English and Russian are loaded on demand), then the switch.
      untracked(() =>
        void loadLang(l).then(() => {
          activeLang.set(l);
          document.documentElement.setAttribute('lang', l);
        }),
      );
    });
  }

  setLang(lang: Lang): void {
    this.store.mutate((s) => (s.settings.lang = lang));
  }
}
