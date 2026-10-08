import { Pipe, PipeTransform } from '@angular/core';
import { fmtTime } from '../../../core/utils';

/** {{ meal.time | time }} — "HH:MM" in the clock format of the settings (24 h or AM/PM). Impure on purpose: it must re-run when the format changes. */
@Pipe({ name: 'time', pure: false })
export class TimePipe implements PipeTransform {
  transform(hm: string | null | undefined): string {
    return fmtTime(hm ?? '');
  }
}
