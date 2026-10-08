import { Injectable, inject, signal } from '@angular/core';
import { AdminUser, Role } from '../../common/interfaces';
import { authErrorText } from '../auth/auth-errors';
import { AdminUsersRepository, RoleDraft } from '../repositories/admin-users.repository';
import { ToastService } from './toast.service';

/**
 * The user list of the management page and the actions on it (change e-mail / password / picture, delete). Every action goes to the
 * backend first; the list on screen changes only when the backend accepted it. A refused action tells the user why (a toast) and returns
 * false. This is not app data, so it lives here and not in `StoreService`.
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly repo = inject(AdminUsersRepository);
  private readonly toast = inject(ToastService);

  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly roles = signal<Role[]>([]);
  readonly rolesLoading = signal(false);
  readonly rolesFailed = signal(false);

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.users.set(await this.repo.list());
      this.loadFailed.set(false);
    } catch (e) {
      this.loadFailed.set(true);
      this.toast.show(authErrorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  async loadRoles(): Promise<void> {
    this.rolesLoading.set(true);
    try {
      this.roles.set(await this.repo.listRoles());
      this.rolesFailed.set(false);
    } catch (e) {
      this.rolesFailed.set(true);
      this.toast.show(authErrorText(e));
    } finally {
      this.rolesLoading.set(false);
    }
  }

  /** Creates or changes a role; returns its id, or null (with a message) when the backend refused. The list changes only after it said yes. */
  async saveRole(draft: RoleDraft): Promise<string | null> {
    try {
      const id = await this.repo.saveRole(draft);
      await this.loadRoles();
      return id;
    } catch (e) {
      this.toast.show(authErrorText(e));
      return null;
    }
  }

  async deleteRole(id: string): Promise<boolean> {
    const ok = await this.run(() => this.repo.deleteRole(id), () => this.roles.update((all) => all.filter((r) => r.id !== id)));
    return ok;
  }

  async setRole(id: string, roleId: string): Promise<boolean> {
    const ok = await this.run(() => this.repo.setRole(id, roleId), () => this.patch(id, { roleId }));
    if (ok && this.roles().length) void this.loadRoles(); // the number of accounts per role changed
    return ok;
  }

  remove(id: string): Promise<boolean> {
    return this.run(() => this.repo.remove(id), () => this.users.update((all) => all.filter((u) => u.id !== id)));
  }

  setEmail(id: string, email: string): Promise<boolean> {
    return this.run(() => this.repo.setEmail(id, email), () => this.patch(id, { email }));
  }

  setPassword(id: string, password: string): Promise<boolean> {
    return this.run(() => this.repo.setPassword(id, password), () => undefined);
  }

  setAvatar(id: string, avatar: string | null): Promise<boolean> {
    return this.run(() => this.repo.setAvatar(id, avatar), () => this.patch(id, { avatar }));
  }

  private patch(id: string, change: Partial<AdminUser>): void {
    this.users.update((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u)));
  }

  private async run(call: () => Promise<void>, applied: () => void): Promise<boolean> {
    try {
      await call();
      applied();
      return true;
    } catch (e) {
      this.toast.show(authErrorText(e));
      return false;
    }
  }
}
