import { AccordionContent, AccordionGroup, AccordionPanel, AccordionTrigger } from '@angular/aria/accordion';
import { ChangeDetectionStrategy, Component, booleanAttribute, input, model } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * One folding section (Angular Aria accordion) in the app's FAQ look: a flat title row with a plus that turns into a cross, a short
 * summary on the right that stays visible while the section is folded, and a panel that slides open. The content goes inside the tags;
 * it is kept while folded so the height can animate.
 *
 * ```html
 * <app-accordion-item [heading]="'plan.mealFoods' | t" [summary]="'3 · 540 kcal'" [(open)]="open">…</app-accordion-item>
 * ```
 */
@Component({
  selector: 'app-accordion-item',
  imports: [AccordionGroup, AccordionTrigger, AccordionPanel, AccordionContent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div ngAccordionGroup class="animate-rise">
      <button
        ngAccordionTrigger
        type="button"
        class="flex w-full cursor-pointer appearance-none items-center justify-between gap-3 rounded-[calc(var(--r)_*_10px)] border-0 px-2.5 py-3.5 text-left text-[0.875rem] font-semibold text-text [transition:background_.15s] hover:bg-surface-2"
        [class]="open() ? 'bg-surface-2' : 'bg-transparent'"
        [panel]="panel"
        [(expanded)]="open"
      >
        <span>{{ heading() }}</span>
        <span class="flex items-center gap-3 text-[0.8125rem] font-normal text-muted tabular-nums">
          {{ summary() }}
          <!-- One plus that turns by 45 degrees into a cross while the item is open. It sits in a span of its own: the icon element is display:contents, which has no box to turn. -->
          <span class="inline-grid shrink-0 place-items-center text-text [transition:transform_.2s_ease]" [style.transform]="open() ? 'rotate(45deg)' : 'rotate(0deg)'">
            <app-icon name="plus" />
          </span>
        </span>
      </button>
      <!-- The panel keeps its content while folded so the height can animate (grid rows 0fr to 1fr). -->
      <div class="grid [transition:grid-template-rows_.25s_ease,opacity_.25s_ease]" [class]="open() ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'">
        <div ngAccordionPanel #panel="ngAccordionPanel" [preserveContent]="true" class="min-h-0 overflow-hidden">
          <ng-template ngAccordionContent>
            <div [class]="bare() ? 'px-2.5 pt-1 pb-3.5' : 'mt-2.5 mb-3.5 rounded-[calc(var(--r)_*_14px)] border border-border-soft bg-surface-2 p-3.5'">
              <ng-content />
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
})
export class AccordionItemComponent {
  /** Title of the section (already translated). */
  readonly heading = input.required<string>();
  /** Short text on the right of the title, e.g. a count (already translated). */
  readonly summary = input('');
  /** No framed box around the content: it sits directly under the title (the owner draws its own look). */
  readonly bare = input(false, { transform: booleanAttribute });
  /** Whether the section is open; two-way (`[(open)]`). */
  readonly open = model(false);
}
