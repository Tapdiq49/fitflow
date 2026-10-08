import { Directive, TemplateRef, inject, input } from '@angular/core';

/** Marks a template as the content of one column's cell: `<ng-template appTableCell="actions" let-row>…</ng-template>`. */
@Directive({ selector: 'ng-template[appTableCell]' })
export class TableCellDirective {
  readonly id = input.required<string>({ alias: 'appTableCell' });
  readonly template = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}
