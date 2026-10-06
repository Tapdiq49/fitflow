import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ProgramService } from '../core/services/program.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-type-badge',
  imports: [IconComponent],
  template: `
    <span class="badge" [class]="badgeClass()">
      <app-icon [name]="iconName()" size="sm" />{{ program.typeLabel(type()) }}
      @if (variant(); as v) {
        — FULL BODY {{ v }}
      }
    </span>
  `,
  host: { style: 'display:contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeBadgeComponent {
  readonly date = input.required<string>();
  protected readonly program = inject(ProgramService);
  protected readonly type = computed(() => this.program.dayType(this.date()));
  protected readonly variant = computed(() => this.program.variant(this.date()));
  protected readonly badgeClass = computed(() => ({ training: 'badge-training', cardio: 'badge-cardio', rest: 'badge-rest' })[this.type()]);
  protected readonly iconName = computed(() => ({ training: 'dumbbell', cardio: 'heart', rest: 'moon' })[this.type()]);
}
