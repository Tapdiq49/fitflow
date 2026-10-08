import { ChangeDetectionStrategy, Component, Injector, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { REFERENCE_LISTS } from './reference-lists';

/** Reference index: a grid with one card per list; a card opens that list's own page. */
@Component({
  selector: 'app-references-page',
  imports: [RouterLink, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      @for (l of lists(); track l.id) {
        <a
          class="card flex flex-col gap-2 text-inherit no-underline [transition:border-color_.2s] hover:border-accent focus-visible:border-accent focus-visible:outline-none"
          [routerLink]="['/references', l.id]"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="grid size-9 place-items-center rounded-[calc(var(--r)_*_10px)] bg-accent-soft text-accent"><app-icon [name]="l.icon" /></span>
            <span class="badge">{{ 'references.nEntries' | t: { n: l.count } }}</span>
          </div>
          <h3 class="text-[1rem] font-bold">{{ l.label | t }}</h3>
          <p class="m-0 text-[0.8125rem] text-muted">{{ l.summary | t }}</p>
        </a>
      }
    </div>
  `,
})
export class ReferencesPage {
  private readonly injector = inject(Injector);
  protected readonly lists = computed(() => REFERENCE_LISTS.map((l) => ({ ...l, count: l.count(this.injector) })));
}
