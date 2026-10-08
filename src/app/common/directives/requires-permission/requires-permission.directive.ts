import { Directive, computed, inject, input } from '@angular/core';
import { PermissionId } from '../../interfaces';
import { PermissionService } from '../../../core/services/permission.service';

/**
 * Makes an element read-only for a person without the permission: `<div appRequires="plan.edit">`. Without it the element and everything in
 * it is inert (no clicks, no focus, also for custom controls) and shown dimmed. Use it on the part of a page that changes data; the
 * viewing part stays open. This only guides the UI; whatever matters is checked on the server.
 */
@Directive({
  selector: '[appRequires]',
  host: {
    '[attr.inert]': "allowed() ? null : ''",
    '[attr.aria-disabled]': "allowed() ? null : 'true'",
    '[class.opacity-60]': '!allowed()',
  },
})
export class RequiresPermissionDirective {
  readonly appRequires = input.required<PermissionId>();
  private readonly perms = inject(PermissionService);
  protected readonly allowed = computed(() => this.perms.can(this.appRequires()));
}
