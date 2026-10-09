import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminUser } from '../../common/interfaces';
import { RequiresPermissionDirective } from '../../common/directives/requires-permission/requires-permission.directive';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthStore } from '../../core/auth/auth.store';
import { authErrorText } from '../../core/auth/auth-errors';
import { imageToAvatarDataUrl } from '../../core/auth/avatar';
import { isEmail, isStrongPassword } from '../../core/auth/auth-validation';
import { t } from '../../core/i18n/translate';
import { PagedQuery, pageSlice } from '../../core/paging';
import { AdminUsersService } from '../../core/services/admin-users.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { activeLang, inputValue } from '../../core/utils';
import { SelectFieldComponent, SelectOption } from '../../shared/forms/select-field/select-field.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { ModalComponent } from '../../shared/modal/modal.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { DataTableComponent, TableColumn } from '../../shared/table/data-table.component';
import { TableCellDirective } from '../../common/directives/table-cell/table-cell.directive';
import { TextFieldComponent } from '../../shared/forms/text-field/text-field.component';
import { FieldValue } from '../../shared/forms/field-base/field-base';

/**
 * User management (administrators only): every account with its picture, e-mail, sign-up and last sign-in dates, and the actions
 * change e-mail, set a new password, change or remove the picture, and delete. The page is hidden for everybody else and the Edge
 * Function `admin-users` refuses them anyway. Permissions finer than "administrator" can be added later in the Edge Function.
 */
@Component({
  selector: 'app-users-page',
  imports: [TextFieldComponent, NgTemplateOutlet, DataTableComponent, TableCellDirective, PaginationComponent, ModalComponent, SelectFieldComponent, RequiresPermissionDirective, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #avatar let-u let-size="size">
      @if (u.avatar) {
        <img [src]="u.avatar" alt="" class="shrink-0 rounded-full object-cover" [style.width.px]="size" [style.height.px]="size" />
      } @else {
        <span class="grid shrink-0 place-items-center rounded-full bg-accent font-extrabold text-accent-ink uppercase" [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * 0.4">{{ (u.username ?? u.email).charAt(0) }}</span>
      }
    </ng-template>

    <div class="card">
      <div class="card-head">
        <h3><app-icon name="users" /> {{ 'admin.title' | t }}</h3>
        <span class="flex items-center gap-2">
          <span class="badge">{{ total() }}</span>
          <button class="btn btn-sm" [disabled]="users.loading()" [attr.aria-busy]="users.loading()" (click)="users.load()">@if (users.loading()) { <span class="spinner"></span> } @else { <app-icon name="refresh" size="sm" /> }{{ 'admin.refresh' | t }}</button>
        </span>
      </div>
      <p class="text-muted" style="font-size: 0.75rem; margin: 0 0 12px">{{ 'admin.hint' | t }}</p>
      @if (users.loadFailed()) {
        <div class="alert alert-warn mb-3" role="status"><app-icon name="alert" /><div>{{ 'admin.loadFailed' | t }}</div></div>
      }
      <app-text-field class="w-full" [value]="q.searchInput()" (input)="q.setSearch(val($event))" [placeholder]="'admin.search' | t" [label]="'admin.search' | t" />
      <div class="mb-3"></div>
      <app-data-table [columns]="columns()" [rows]="view().rows" [rowKey]="rowKey" [emptyText]="'admin.empty' | t" [loading]="users.loading()" [loadingLabel]="'common.loading' | t">
        <ng-template appTableCell="user" let-u>
          <div class="flex items-center gap-2.5">
            <ng-container *ngTemplateOutlet="avatar; context: { $implicit: u, size: 36 }" />
            <div class="min-w-0">
              <div class="truncate font-semibold">{{ u.username ?? '—' }} @if (u.id === me()) { <span class="badge">{{ 'admin.you' | t }}</span> }</div>
              <div class="truncate text-[0.75rem] text-muted">{{ u.email }}</div>
            </div>
          </div>
        </ng-template>
        <ng-template appTableCell="status" let-u>
          <span class="badge">{{ roleName(u.roleId) }}</span>
          @if (!u.emailConfirmed) {
            <span class="badge">{{ 'admin.unconfirmed' | t }}</span>
          }
        </ng-template>
        <ng-template appTableCell="actions" let-u>
          <button class="btn btn-ghost btn-icon btn-sm" (click)="editingId.set(u.id)" [attr.aria-label]="('admin.edit' | t) + ': ' + u.email"><app-icon name="edit" size="sm" /></button>
          <button class="btn btn-ghost btn-icon btn-sm" appRequires="users.delete" [disabled]="u.id === me()" [title]="u.id === me() ? ('admin.cannotDeleteSelf' | t) : ''" (click)="remove(u)" [attr.aria-label]="('common.delete' | t) + ': ' + u.email"><app-icon name="trash" size="sm" /></button>
        </ng-template>
      </app-data-table>
      @if (total() > 0) {
        <app-pagination [page]="q.page()" [pageSize]="q.pageSize()" [total]="total()" (pageChange)="q.setPage($event)" (pageSizeChange)="q.setPageSize($event)" />
      }
    </div>

    @if (edited(); as u) {
      <app-modal [heading]="'admin.edit' | t" (closed)="editingId.set(null)">
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <ng-container *ngTemplateOutlet="avatar; context: { $implicit: u, size: 64 }" />
            <div class="flex flex-col gap-2">
              <div class="font-semibold">{{ u.username ?? u.email }}</div>
              <div class="flex flex-wrap gap-2" appRequires="users.edit_avatar">
                <button class="btn btn-sm" [disabled]="busy()" (click)="file.click()"><app-icon name="upload" size="sm" />{{ 'profile.changePhoto' | t }}</button>
                @if (u.avatar) {
                  <button class="btn btn-sm btn-danger" [disabled]="busy()" (click)="removePhoto(u)"><app-icon name="trash" size="sm" />{{ 'profile.removePhoto' | t }}</button>
                }
              </div>
              <input #file type="file" accept="image/*" hidden (change)="pickPhoto(u, file)" />
            </div>
          </div>

          <div class="field" appRequires="users.assign_role">
            {{ 'admin.role' | t }}
            <app-select-field [label]="'admin.role' | t" [options]="roleOptions()" [value]="u.roleId" [disabled]="u.id === me() || busy()" (valueChange)="changeRole(u, $event)" />
          </div>

          <form class="flex flex-col gap-2" appRequires="users.edit_email" (submit)="saveEmail($event, u, email.value)" novalidate>
            <label class="field">{{ 'admin.newEmail' | t }}<app-text-field #email inputmode="email" autocomplete="off" [value]="u.email" /></label>
            <div><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">{{ 'common.save' | t }}</button></div>
          </form>

          <form class="flex flex-col gap-2" appRequires="users.edit_password" (submit)="savePassword($event, u, pw)" novalidate>
            <label class="field">{{ 'admin.newPassword' | t }}<app-text-field #pw type="password" autocomplete="new-password" /></label>
            <small class="text-muted">{{ 'admin.passwordHint' | t }}</small>
            <div><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">{{ 'common.save' | t }}</button></div>
          </form>
        </div>
      </app-modal>
    }
  `,
})
export class UsersPage {
  protected readonly users = inject(AdminUsersService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);

  protected readonly val = inputValue;
  protected readonly q = new PagedQuery();
  protected readonly me = computed(() => this.auth.user()?.id ?? null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly edited = computed(() => this.users.users().find((u) => u.id === this.editingId()) ?? null);
  /** An action of the open dialog is on its way to the backend. */
  protected readonly busy = signal(false);

  protected readonly roleOptions = computed<SelectOption<string>[]>(() => this.users.roles().map((r) => ({ value: r.id, label: r.name })));
  protected readonly rowKey = (u: AdminUser): string => u.id;
  protected readonly view = computed(() => pageSlice(this.users.users(), this.q.params(), (u) => `${u.email} ${u.username ?? ''}`));
  protected readonly total = computed(() => this.view().total ?? 0);
  protected readonly columns = computed<TableColumn<AdminUser>[]>(() => [
    { id: 'user', header: t('admin.user') },
    { id: 'created', header: t('admin.created'), value: (u) => this.date(u.createdAt) },
    { id: 'seen', header: t('admin.lastSignIn'), value: (u) => (u.lastSignInAt ? this.date(u.lastSignInAt) : t('admin.never')) },
    { id: 'status', header: t('admin.status') },
    { id: 'actions', header: '', class: 'text-right' },
  ]);

  constructor() {
    void this.users.load();
    void this.users.loadRoles();
  }

  protected roleName(id: string): string {
    return this.users.roles().find((r) => r.id === id)?.name ?? id;
  }

  protected async changeRole(u: AdminUser, roleId: string): Promise<void> {
    if (roleId === u.roleId) return;
    if (await this.act(() => this.users.setRole(u.id, roleId))) this.toast.show(t('admin.roleChanged'));
  }

  private date(iso: string): string {
    return new Date(iso).toLocaleDateString(activeLang());
  }

  protected async remove(u: AdminUser): Promise<void> {
    if (!(await this.confirm.ask(t('admin.deleteConfirm', { email: u.email }), { confirmLabel: t('common.delete'), danger: true }))) return;
    if (await this.users.remove(u.id)) {
      this.q.clampTo(this.total());
      this.toast.show(t('admin.deleted'));
    }
  }

  protected async saveEmail(e: Event, u: AdminUser, value: string): Promise<void> {
    e.preventDefault();
    const email = value.trim().toLowerCase();
    if (email === u.email) return;
    if (!isEmail(email)) {
      this.toast.show(t('auth.error.invalid_email'));
      return;
    }
    if (await this.act(() => this.users.setEmail(u.id, email))) this.toast.show(t('admin.emailSaved'));
  }

  protected async savePassword(e: Event, u: AdminUser, input: FieldValue): Promise<void> {
    e.preventDefault();
    if (!isStrongPassword(input.value)) {
      this.toast.show(t('auth.error.weak_password'));
      return;
    }
    if (await this.act(() => this.users.setPassword(u.id, input.value))) {
      input.value = '';
      this.toast.show(t('admin.passwordSaved'));
    }
  }

  protected async pickPhoto(u: AdminUser, input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let dataUrl: string;
    try {
      dataUrl = await imageToAvatarDataUrl(file);
    } catch (err) {
      this.toast.show(authErrorText(err));
      return;
    }
    if (await this.act(() => this.users.setAvatar(u.id, dataUrl))) this.toast.show(t('admin.pictureSaved'));
  }

  protected async removePhoto(u: AdminUser): Promise<void> {
    if (await this.act(() => this.users.setAvatar(u.id, null))) this.toast.show(t('admin.pictureSaved'));
  }

  private async act(call: () => Promise<boolean>): Promise<boolean> {
    this.busy.set(true);
    try {
      return await call();
    } finally {
      this.busy.set(false);
    }
  }
}
