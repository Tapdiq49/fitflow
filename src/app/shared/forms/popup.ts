import { ConnectedPosition } from '@angular/cdk/overlay';

/** Look of a dropdown panel (select options, time grid). */
export const POPUP_PANEL = 'block overflow-y-auto rounded-[calc(var(--r)_*_12px)] border border-border bg-surface-2 text-text shadow-[0_12px_32px_rgba(0,0,0,.45)] outline-none';

/** Below the field, or above it when there is no room below. */
export const POPUP_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];
