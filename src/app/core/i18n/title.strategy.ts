import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { activeLang } from '../utils';
import { t } from './translate';

/** Route `title` is a translation key; the tab shows "FitFlow — <page>" and follows language switches. */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private key: string | undefined;

  constructor() {
    super();
    effect(() => {
      activeLang();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    const app = t('app.fitflow');
    this.title.setTitle(this.key ? `${app} — ${t(this.key)}` : app);
  }
}
