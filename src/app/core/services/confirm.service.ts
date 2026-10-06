import { Injectable, signal } from '@angular/core';
import { t } from '../i18n/translate';

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

/** In-app replacement for window.confirm(): a centered modal. Resolves true on confirm, false on cancel/Esc/backdrop. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  ask(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
    this.request()?.resolve(false);
    return new Promise((resolve) => this.request.set({ message, confirmLabel: opts.confirmLabel ?? t('common.yes'), danger: opts.danger ?? false, resolve }));
  }

  answer(ok: boolean): void {
    this.request()?.resolve(ok);
    this.request.set(null);
  }
}
