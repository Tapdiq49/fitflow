import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { ADMIN_ROLE_ID, PERMISSION_GROUPS, Role } from '../../common/interfaces';
import { RequiresPermissionDirective } from '../../common/directives/requires-permission/requires-permission.directive';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthStore } from '../../core/auth/auth.store';
import { t } from '../../core/i18n/translate';
import { AdminUsersService } from '../../core/services/admin-users.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon/icon.component';

const NEW = 'new';

/**
 * Roles and permissions: every page and action of the system is a permission; a role is a named set of them; an account has one role.
 * Built-in roles: `admin` (everything, locked) and `user` (the whole app). Others are created here. Everything goes to the backend first;
 * the list changes only after it said yes, and the Edge Function checks every call (a person can only give permissions they hold).
 */
@Component({
  selector: 'app-roles-page',
  imports: [RequiresPermissionDirective, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="card-head">
        <h3><app-icon name="shield" /> {{ 'roles.title' | t }}</h3>
        <span class="flex items-center gap-2">
          <button class="btn btn-sm" [disabled]="admin.rolesLoading()" [attr.aria-busy]="admin.rolesLoading()" (click)="admin.loadRoles()">@if (admin.rolesLoading()) { <span class="spinner"></span> } @else { <app-icon name="refresh" size="sm" /> }{{ 'admin.refresh' | t }}</button>
          <button class="btn btn-sm btn-primary" appRequires="roles.create" (click)="selectedId.set(NEW)"><app-icon name="plus" size="sm" />{{ 'roles.new' | t }}</button>
        </span>
      </div>
      <p class="text-muted" style="font-size: 0.75rem; margin: 0">{{ 'roles.hint' | t }}</p>
      @if (admin.rolesFailed()) {
        <div class="alert alert-warn mt-3" role="status"><app-icon name="alert" /><div>{{ 'roles.loadFailed' | t }}</div></div>
      }
    </div>

    <div class="mt-4 grid grid-cols-[16rem_1fr] items-start gap-4 tablet:grid-cols-1">
      <div class="card sticky top-[calc(var(--header-h,0px)_+_1rem)] flex max-h-[calc(100vh_-_var(--header-h,0px)_-_2rem)] flex-col gap-1.5 overflow-y-auto transition-opacity tablet:static tablet:max-h-none" role="list" [attr.aria-label]="'roles.title' | t" [attr.aria-busy]="admin.rolesLoading()" [class.opacity-50]="admin.rolesLoading()" [class.pointer-events-none]="admin.rolesLoading()">
        @for (r of admin.roles(); track r.id) {
          <button
            type="button"
            role="listitem"
            class="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-[calc(var(--r)_*_10px)] border bg-bg px-3 py-2 text-start outline-none focus-visible:border-accent"
            [class]="selectedId() === r.id ? 'border-accent bg-accent-soft' : 'border-border-soft hover:border-border-hover'"
            [attr.aria-pressed]="selectedId() === r.id"
            (click)="selectedId.set(r.id)"
          >
            <span class="flex w-full items-center justify-between gap-2 font-semibold">
              <span class="truncate">{{ r.name }}</span>
              @if (r.isSystem) {
                <span class="badge"><app-icon name="lock" size="sm" />{{ 'roles.system' | t }}</span>
              }
            </span>
            <span class="text-[0.75rem] text-muted">{{ 'roles.usersCount' | t: { n: r.users } }} · {{ r.permissions.length }}/{{ total }}</span>
          </button>
        } @empty {
          @if (admin.rolesLoading()) {
            <span class="flex items-center gap-2 text-muted"><span class="spinner"></span>{{ 'common.loading' | t }}</span>
          } @else {
            <span class="text-muted">{{ 'roles.empty' | t }}</span>
          }
        }
      </div>

      @if (selectedId() !== null) {
        <div class="card">
          <div class="card-head">
            <h3>{{ isNew() ? ('roles.new' | t) : selected()?.name }}</h3>
          </div>

          @if (locked()) {
            <div class="alert alert-info mb-3" role="status"><app-icon name="lock" /><div>{{ 'roles.adminLocked' | t }}</div></div>
          }

          <div class="flex flex-col gap-3" [attr.inert]="locked() ? '' : null" [class.opacity-70]="locked()">
            <label class="field">{{ 'roles.name' | t }}<input type="text" maxlength="60" [value]="name()" (input)="name.set(val($event))" /></label>
            <label class="field">{{ 'roles.description' | t }}<input type="text" maxlength="200" [value]="description()" (input)="description.set(val($event))" /></label>

            @for (g of groups; track g.module) {
              <fieldset class="m-0 rounded-[calc(var(--r)_*_10px)] border border-border-soft p-3">
                <legend class="flex items-center gap-3 px-1 text-[0.8125rem] font-bold">
                  {{ 'perm.module.' + g.module | t }}
                  <button type="button" class="btn btn-ghost btn-sm" (click)="setGroup(g.permissions, !groupAll(g.permissions))">{{ (groupAll(g.permissions) ? 'roles.none' : 'roles.all') | t }}</button>
                </legend>
                <div class="grid grid-cols-2 gap-x-4 tablet:grid-cols-1">
                  @for (p of g.permissions; track p) {
                    <label class="flex cursor-pointer items-start gap-2.5 py-1.5 text-[0.8125rem]" [class.opacity-50]="!canGrant(p)" [title]="canGrant(p) ? '' : ('roles.cannotGrant' | t)">
                      <input type="checkbox" class="mt-0.5" [checked]="has(p)" [disabled]="!canGrant(p)" (change)="toggle(p)" />
                      <span>{{ 'perm.' + p | t }}</span>
                    </label>
                  }
                </div>
              </fieldset>
            }
          </div>

          <!-- The administrator role cannot be changed or deleted: nothing to save, so no buttons. -->
          @if (!locked()) {
            <div class="mt-4 flex flex-wrap gap-2">
              <button class="btn btn-primary" [disabled]="busy() || !canSave()" [attr.title]="canSave() ? null : ('roles.needPermission' | t)" (click)="save()">
                @if (busy()) { <span class="spinner"></span> } @else { <app-icon name="save" size="sm" /> }{{ 'common.save' | t }}
              </button>
              @if (!isNew() && selected(); as r) {
                @if (!r.isSystem) {
                  <button class="btn btn-danger" appRequires="roles.delete" [disabled]="busy()" (click)="remove(r)"><app-icon name="trash" size="sm" />{{ 'common.delete' | t }}</button>
                }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class RolesPage {
  protected readonly admin = inject(AdminUsersService);
  private readonly auth = inject(AuthStore);
  private readonly perms = inject(PermissionService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly NEW = NEW;
  protected readonly groups = PERMISSION_GROUPS;
  protected readonly total = PERMISSION_GROUPS.reduce((n, g) => n + g.permissions.length, 0);
  protected readonly val = inputValue;

  protected readonly selectedId = signal<string | null>(null);
  protected readonly isNew = computed(() => this.selectedId() === NEW);
  protected readonly selected = computed<Role | null>(() => this.admin.roles().find((r) => r.id === this.selectedId()) ?? null);
  /** The administrator role holds everything and cannot be edited. */
  protected readonly locked = computed(() => this.selected()?.id === ADMIN_ROLE_ID);
  protected readonly busy = signal(false);

  protected readonly name = linkedSignal(() => this.selected()?.name ?? '');
  protected readonly description = linkedSignal(() => this.selected()?.description ?? '');
  protected readonly granted = linkedSignal<string[]>(() => [...(this.selected()?.permissions ?? [])]);

  /** What the person may do with the open role: create when it is new, edit otherwise. */
  protected readonly canSave = computed(() => this.perms.can(this.isNew() ? 'roles.create' : 'roles.edit'));

  constructor() {
    void this.admin.loadRoles();
  }

  protected has(p: string): boolean {
    return this.locked() || this.granted().includes(p);
  }

  /** Nobody gives away more than they hold (the administrator role may give anything). */
  protected canGrant(p: string): boolean {
    return this.auth.user()?.roleId === ADMIN_ROLE_ID || this.perms.can(p);
  }

  protected toggle(p: string): void {
    this.granted.update((all) => (all.includes(p) ? all.filter((x) => x !== p) : [...all, p]));
  }

  protected groupAll(ids: readonly string[]): boolean {
    return ids.filter((p) => this.canGrant(p)).every((p) => this.granted().includes(p));
  }

  protected setGroup(ids: readonly string[], on: boolean): void {
    const grantable = ids.filter((p) => this.canGrant(p));
    this.granted.update((all) => (on ? [...new Set([...all, ...grantable])] : all.filter((p) => !grantable.includes(p))));
  }

  protected async save(): Promise<void> {
    if (!this.name().trim()) {
      this.toast.show(t('roles.nameRequired'));
      return;
    }
    this.busy.set(true);
    try {
      const id = await this.admin.saveRole({ id: this.isNew() ? undefined : (this.selectedId() ?? undefined), name: this.name().trim(), description: this.description().trim(), permissions: this.granted() });
      if (id) {
        this.selectedId.set(id);
        this.toast.show(t('roles.saved'));
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(r: Role): Promise<void> {
    if (!(await this.confirm.ask(t('roles.deleteConfirm', { name: r.name }), { confirmLabel: t('common.delete'), danger: true }))) return;
    if (await this.admin.deleteRole(r.id)) {
      this.selectedId.set(null);
      this.toast.show(t('roles.deleted'));
    }
  }
}
