import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS } from '../core/data/icons';

/** Inline SVG icon. Paths come from the static ICONS table, so bypassing sanitization is safe. */
@Component({
  selector: 'app-icon',
  template: '',
  host: { '[innerHTML]': 'html()', style: 'display:contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<'' | 'sm'>('');
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly html = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      `<svg class="${this.size() === 'sm' ? 'icon icon-sm' : 'icon'}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[this.name()] ?? ''}</svg>`,
    ),
  );
}
