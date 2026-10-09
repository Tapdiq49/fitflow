import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Role } from '../../common/interfaces';
import { authErrorText } from '../auth/auth-errors';
import { AdminUsersRepository, RoleDraft } from '../repositories/admin-users.repository';
import { activeLang } from '../utils';
import { ToastService } from './toast.service';

/**
 * The roles and the actions of the user management page (change e-mail / password / picture / role, delete). Every action goes to the
 * backend first and a refused one tells the user why (a toast) and returns false. The user list itself is a paged table: the page reads
 * it with `pagedResource` through `AdminUsersRepository.request` / `parse` (like every backend list) and reloads it after an accepted
 * action. This is not app data, so it lives here and not in `StoreService`.
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly repo = inject(AdminUsersRepository);
  private readonly toast = inject(ToastService);

  readonly roles = signal<Role[]>([]);
  readonly rolesLoading = signal(false);
  readonly rolesFailed = signal(false);

  constructor() {
    // The names of the built-in roles come from the backend in the active language: a language switch reads them again.
    effect(() => {
      activeLang();
      untracked(() => {
        if (this.roles().length) void this.loadRoles();
      });
    });
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
    const ok = await this.run(() => this.repo.setRole(id, roleId), () => undefined);
    if (ok && this.roles().length) void this.loadRoles(); // the number of accounts per role changed
    return ok;
  }

  remove(id: string): Promise<boolean> {
    return this.run(() => this.repo.remove(id), () => undefined);
  }

  setEmail(id: string, email: string): Promise<boolean> {
    return this.run(() => this.repo.setEmail(id, email), () => undefined);
  }

  setPassword(id: string, password: string): Promise<boolean> {
    return this.run(() => this.repo.setPassword(id, password), () => undefined);
  }

  setAvatar(id: string, avatar: string | null): Promise<boolean> {
    return this.run(() => this.repo.setAvatar(id, avatar), () => undefined);
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
