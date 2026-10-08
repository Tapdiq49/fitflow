import { Pipe, PipeTransform } from '@angular/core';
import { t, td } from '../../../core/i18n/translate';

/** {{ 'settings.title' | t }} — impure on purpose: it must re-run when the language signal changes. */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(key: string, params?: Record<string, string | number | null | undefined>): string {
    return t(key, params);
  }
}

/** {{ meal.name | td }} — translates built-in content text (see translate.ts). */
@Pipe({ name: 'td', pure: false })
export class TdPipe implements PipeTransform {
  transform(text: string | null | undefined): string {
    return td(text ?? '');
  }
}
