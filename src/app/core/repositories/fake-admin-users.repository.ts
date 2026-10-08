import { AdminUser, DEFAULT_ROLE_ID, Role } from '../../common/interfaces';
import { AuthError } from '../../common/interfaces/auth/auth.models';
import { AdminUsersRepository, RoleDraft } from './admin-users.repository';

/** In-memory AdminUsersRepository for specs. `users` and `roles` are the tables; set `failing` to simulate an unreachable backend. */
export class FakeAdminUsersRepository extends AdminUsersRepository {
  users: AdminUser[] = [];
  roles: Role[] = [
    { id: 'admin', name: 'Administrator', description: '', isSystem: true, permissions: ['users.view', 'roles.view'], users: 0 },
    { id: DEFAULT_ROLE_ID, name: 'User', description: '', isSystem: true, permissions: ['today.view'], users: 0 },
  ];
  failing = false;
  /** Every call in the order it happened, e.g. "delete u2". */
  calls: string[] = [];

  private row(id: string): AdminUser {
    if (this.failing) throw new AuthError('network_error');
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new AuthError('not_found');
    return user;
  }

  async list(): Promise<AdminUser[]> {
    if (this.failing) throw new AuthError('network_error');
    return structuredClone(this.users);
  }

  async remove(id: string): Promise<void> {
    this.row(id);
    this.calls.push(`delete ${id}`);
    this.users = this.users.filter((u) => u.id !== id);
  }

  async setEmail(id: string, email: string): Promise<void> {
    this.row(id).email = email;
    this.calls.push(`email ${id}`);
  }

  async setPassword(id: string, _password: string): Promise<void> {
    this.row(id);
    this.calls.push(`password ${id}`);
  }

  async setAvatar(id: string, avatar: string | null): Promise<void> {
    this.row(id).avatar = avatar;
    this.calls.push(`avatar ${id}`);
  }

  async setRole(id: string, roleId: string): Promise<void> {
    const user = this.row(id);
    if (!this.roles.some((r) => r.id === roleId)) throw new AuthError('invalid_role');
    user.roleId = roleId;
    this.calls.push(`role ${id} ${roleId}`);
  }

  async listRoles(): Promise<Role[]> {
    if (this.failing) throw new AuthError('network_error');
    return structuredClone(this.roles).map((r) => ({ ...r, users: this.users.filter((u) => u.roleId === r.id).length }));
  }

  async saveRole(role: RoleDraft): Promise<string> {
    if (this.failing) throw new AuthError('network_error');
    if (role.id === 'admin') throw new AuthError('system_role');
    const id = role.id ?? `r${this.roles.length + 1}`;
    const saved: Role = { id, name: role.name, description: role.description, isSystem: false, permissions: [...role.permissions], users: 0 };
    const at = this.roles.findIndex((r) => r.id === id);
    if (at >= 0) this.roles[at] = { ...saved, isSystem: this.roles[at].isSystem };
    else this.roles.push(saved);
    this.calls.push(`save-role ${id}`);
    return id;
  }

  async deleteRole(id: string): Promise<void> {
    if (this.failing) throw new AuthError('network_error');
    const role = this.roles.find((r) => r.id === id);
    if (!role) throw new AuthError('not_found');
    if (role.isSystem) throw new AuthError('system_role');
    if (this.users.some((u) => u.roleId === id)) throw new AuthError('role_in_use');
    this.roles = this.roles.filter((r) => r.id !== id);
    this.calls.push(`delete-role ${id}`);
  }
}
