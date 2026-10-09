import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { AdminUser } from '../../common/interfaces';
import { RequiresPermissionDirective } from '../../common/directives/requires-permission/requires-permission.directive';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { AuthStore } from '../../core/auth/auth.store';
import { authErrorText } from '../../core/auth/auth-errors';
import { imageToAvatarDataUrl } from '../../core/auth/avatar';
import { isEmail, isStrongPassword } from '../../core/auth/auth-validation';
import { t } from '../../core/i18n/translate';
import { MIN_SEARCH_LENGTH, PagedQuery, pagedResource } from '../../core/paging';
import { AdminUsersRepository } from '../../core/repositories/admin-users.repository';
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
          <button class="btn btn-sm" [disabled]="list.loading()" [attr.aria-busy]="list.loading()" (click)="list.reload()">@if (list.loading()) { <span class="spinner"></span> } @else { <app-icon name="refresh" size="sm" /> }{{ 'admin.refresh' | t }}</button>
        </span>
      </div>
      <p class="text-muted" style="font-size: 0.75rem; margin: 0 0 12px">{{ 'admin.hint' | t }}</p>
      @if (list.failed()) {
        <div class="alert alert-warn mb-3" role="status"><app-icon name="alert" /><div>{{ 'admin.loadFailed' | t }}</div></div>
      }
      <app-text-field class="w-full" clearable [value]="q.searchInput()" (input)="q.setSearch(val($event))" [placeholder]="'admin.search' | t" [label]="'admin.search' | t" />
      <p class="text-muted mb-3" style="font-size: 0.75rem; margin: 6px 0 0">@if (searchTooShort()) { {{ 'references.searchMin' | t: { n: minSearch } }} }</p>
      <app-data-table [columns]="columns()" [rows]="rows()" [rowKey]="rowKey" [emptyText]="'admin.empty' | t" [loading]="list.loading()" [loadingLabel]="'common.loading' | t">
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
          <span class="badge">{{ u.roleName }}</span>
          @if (!u.emailConfirmed) {
            <span class="badge">{{ 'admin.unconfirmed' | t }}</span>
          }
        </ng-template>
        <ng-template appTableCell="actions" let-u>
          <button class="btn btn-ghost btn-icon btn-sm" (click)="edit(u.id)" [attr.aria-label]="('admin.edit' | t) + ': ' + u.email"><app-icon name="edit" size="sm" /></button>
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
            <ng-container *ngTemplateOutlet="avatar; context: { $implicit: shownUser(), size: 64 }" />
            <div class="flex flex-col gap-2">
              <div class="font-semibold">{{ u.username ?? u.email }}</div>
              <div class="flex flex-wrap gap-2" appRequires="users.edit_avatar">
                <button type="button" class="btn btn-sm" [disabled]="busy()" (click)="file.click()"><app-icon name="upload" size="sm" />{{ 'profile.changePhoto' | t }}</button>
                @if (shownAvatar()) {
                  <button type="button" class="btn btn-sm btn-danger" [disabled]="busy()" (click)="avatarDraft.set(null)"><app-icon name="trash" size="sm" />{{ 'profile.removePhoto' | t }}</button>
                }
              </div>
              <input #file type="file" accept="image/*" hidden (change)="pickPhoto(file)" />
            </div>
          </div>

          <!-- One form, one Save: the role, the e-mail and the new password are sent together, and only what changed. -->
          <form class="flex flex-col gap-4" (submit)="saveAll($event, u, email, pw)" novalidate>
            <div class="field" appRequires="users.assign_role">
              {{ 'admin.role' | t }}
              <app-select-field [label]="'admin.role' | t" [options]="roleOptions()" [value]="pendingRole()" [placeholder]="u.roleName" [loading]="users.rolesLoading()" [disabled]="u.id === me()" (valueChange)="pendingRole.set($event)" />
            </div>
            <label class="field" appRequires="users.edit_email">{{ 'admin.newEmail' | t }}<app-text-field #email inputmode="email" autocomplete="off" [value]="u.email" /></label>
            <div class="flex flex-col gap-1.5" appRequires="users.edit_password">
              <label class="field">{{ 'admin.newPassword' | t }}<app-text-field #pw type="password" autocomplete="new-password" /></label>
              <small class="text-muted">{{ 'admin.passwordHint' | t }}</small>
            </div>
            <div><button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || list.loading()">@if (busy()) { <span class="spinner"></span> }{{ 'common.save' | t }}</button></div>
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
  protected readonly minSearch = MIN_SEARCH_LENGTH;
  protected readonly searchTooShort = computed(() => {
    const n = this.q.searchInput().trim().length;
    return n > 0 && n < MIN_SEARCH_LENGTH;
  });
  protected readonly me = computed(() => this.auth.user()?.id ?? null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly edited = computed(() => this.rows().find((u) => u.id === this.editingId()) ?? null);
  /** The picture chosen in the dialog, not saved yet: undefined = unchanged, null = removed. It starts again whenever another account is opened. */
  protected readonly avatarDraft = linkedSignal<string | null | undefined>(() => {
    this.editingId();
    return undefined;
  });
  protected readonly shownAvatar = computed(() => {
    const draft = this.avatarDraft();
    return draft !== undefined ? draft : (this.edited()?.avatar ?? null);
  });
  /** The open account as the dialog shows it (with the picture that is chosen but not saved yet). */
  protected readonly shownUser = computed(() => {
    const u = this.edited();
    return u ? { ...u, avatar: this.shownAvatar() } : null;
  });
  /** The role of the open account as the list has it (a plain value, so a reload that changes nothing keeps the choice in the dialog). */
  private readonly editedRole = computed(() => this.edited()?.roleId ?? '');
  /** The role chosen in the dialog, not saved yet; it starts again from the account's role whenever that changes. */
  protected readonly pendingRole = linkedSignal(() => this.editedRole());
  /** An action of the open dialog is on its way to the backend. */
  protected readonly busy = signal(false);

  protected readonly roleOptions = computed<SelectOption<string>[]>(() => this.users.roles().map((r) => ({ value: r.id, label: r.name })));
  protected readonly rowKey = (u: AdminUser): string => u.id;
  private readonly repo = inject(AdminUsersRepository);
  /** The backend page: every new page, page size or search text is a request, and a newer one cancels the one still running. */
  protected readonly list = pagedResource<AdminUser>(this.q, this.repo);
  protected readonly rows = computed(() => this.list.view()?.rows ?? []);
  protected readonly total = computed(() => this.list.view()?.total ?? this.rows().length);
  protected readonly columns = computed<TableColumn<AdminUser>[]>(() => [
    { id: 'user', header: t('admin.user') },
    { id: 'created', header: t('admin.created'), value: (u) => this.date(u.createdAt) },
    { id: 'seen', header: t('admin.lastSignIn'), value: (u) => (u.lastSignInAt ? this.date(u.lastSignInAt) : t('admin.never')) },
    { id: 'status', header: t('admin.status') },
    { id: 'actions', header: '', class: 'text-right' },
  ]);

  constructor() {
    // A page that no longer exists (accounts deleted) goes back to the last one.
    effect(() => {
      const total = this.total();
      untracked(() => this.q.clampTo(total));
    });
  }

  /** The roles are needed only by the role select of the dialog, so they are read when it opens (not with the list). */
  protected edit(id: string): void {
    this.editingId.set(id);
    if (!this.users.roles().length) void this.users.loadRoles();
  }

  private date(iso: string): string {
    return new Date(iso).toLocaleDateString(activeLang());
  }

  protected async remove(u: AdminUser): Promise<void> {
    if (!(await this.confirm.ask(t('admin.deleteConfirm', { email: u.email }), { confirmLabel: t('common.delete'), danger: true }))) return;
    if (await this.users.remove(u.id)) {
      this.list.reload();
      this.toast.show(t('admin.deleted'));
    }
  }

  /** Saves what changed in the dialog (role, e-mail, new password) one after the other; the first refusal stops it and tells why. */
  protected async saveAll(e: Event, u: AdminUser, emailField: FieldValue, pwField: FieldValue): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    const email = emailField.value.trim().toLowerCase();
    const password = pwField.value;
    const role = this.pendingRole();
    const emailChanged = email !== u.email;
    const roleChanged = role !== u.roleId && u.id !== this.me();
    const passwordSet = password !== '';
    const picture = this.avatarDraft();
    const pictureChanged = picture !== undefined && picture !== u.avatar;
    if (!emailChanged && !roleChanged && !passwordSet && !pictureChanged) return;
    if (emailChanged && !isEmail(email)) {
      this.toast.show(t('auth.error.invalid_email'));
      return;
    }
    if (passwordSet && !isStrongPassword(password)) {
      this.toast.show(t('auth.error.weak_password'));
      return;
    }
    this.busy.set(true);
    // The list is read again only when the backend accepted something; a refusal changes nothing, so there is nothing new to fetch.
    let saved = false;
    try {
      if (emailChanged) {
        if (!(await this.users.setEmail(u.id, email))) return;
        saved = true;
      }
      if (roleChanged) {
        if (!(await this.users.setRole(u.id, role))) return;
        saved = true;
      }
      if (pictureChanged) {
        if (!(await this.users.setAvatar(u.id, picture))) return;
        saved = true;
      }
      if (passwordSet && !(await this.users.setPassword(u.id, password))) return;
      pwField.value = '';
      this.toast.show(t('admin.userSaved'));
      this.editingId.set(null); // saved: the dialog closes (the picture draft starts again with the next account)
    } finally {
      this.busy.set(false);
      if (saved) this.list.reload();
    }
  }

  /** The chosen picture is only shown; it is sent with the rest when Save is pressed. */
  protected async pickPhoto(input: HTMLInputElement): Promise<void> {
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
    this.avatarDraft.set(dataUrl);
  }

  private async act(call: () => Promise<boolean>): Promise<boolean> {
    this.busy.set(true);
    try {
      const ok = await call();
      if (ok) this.list.reload();
      return ok;
    } finally {
      this.busy.set(false);
    }
  }
}
