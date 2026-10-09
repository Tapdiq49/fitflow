import { Directive, computed, inject, input } from '@angular/core';
import { DataSyncService } from '../../../core/services/data-sync.service';

/**
 * Shows that a change is waiting for the backend: `<button [appBusy]="BUSY.water(k())">`. While a change made with that key (see
 * `core/busy-keys.ts`) is queued or in flight, the element is inert and shows a loader (styles in `styles.scss`, `aria-busy`).
 * Guests never wait, so nothing is ever shown for them.
 */
@Directive({
  selector: '[appBusy]',
  host: {
    '[attr.aria-busy]': "busy() ? 'true' : null",
  },
})
export class BusyDirective {
  readonly appBusy = input.required<string>();
  private readonly data = inject(DataSyncService);
  protected readonly busy = computed(() => this.data.busy(this.appBusy()));
}
