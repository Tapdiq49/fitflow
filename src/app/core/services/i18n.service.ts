import { Injectable, effect, inject } from '@angular/core';
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
      activeLang.set(l);
      document.documentElement.setAttribute('lang', l);
    });
  }

  setLang(lang: Lang): void {
    this.store.mutate((s) => (s.settings.lang = lang));
  }
}
