import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AuthUser } from '../../common/interfaces/auth/auth.models';

/** The user's picture, or the first letter of their name on the accent color when there is none. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent font-extrabold text-accent-ink uppercase',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.4',
  },
  template: `
    @if (user().avatar; as src) {
      <img [src]="src" alt="" class="size-full object-cover" />
    } @else {
      {{ initial() }}
    }
  `,
})
export class AvatarComponent {
  readonly user = input.required<AuthUser>();
  readonly size = input(36);
  protected readonly initial = computed(() => (this.user().username ?? this.user().email).charAt(0));
}
