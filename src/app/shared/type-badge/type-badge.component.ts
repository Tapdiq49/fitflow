import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ProgramService } from '../../core/services/program.service';
import { WorkoutService } from '../../core/services/workout.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-type-badge',
  imports: [IconComponent],
  template: `
    <span class="badge" [class]="badgeClass()">
      <app-icon [name]="iconName()" size="sm" />{{ program.typeLabel(type()) }}
      @if (title(); as t) {
        — {{ t }}
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
  private readonly workout = inject(WorkoutService);
  protected readonly title = computed(() => (this.program.variant(this.date()) ? this.workout.title(this.date()) : null));
  protected readonly badgeClass = computed(() => ({ training: 'badge-training', cardio: 'badge-cardio', rest: 'badge-rest' })[this.type()]);
  protected readonly iconName = computed(() => ({ training: 'dumbbell', cardio: 'heart', rest: 'moon' })[this.type()]);
}
