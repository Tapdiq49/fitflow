import { TestBed } from '@angular/core/testing';
import { AdminUser } from '../../common/interfaces';
import { AdminUsersRepository } from '../repositories/admin-users.repository';
import { FakeAdminUsersRepository } from '../repositories/fake-admin-users.repository';
import { AdminUsersService } from './admin-users.service';
import { ToastService } from './toast.service';

const user = (id: string, email: string): AdminUser => ({ id, email, username: id, avatar: null, roleId: 'user', roleName: 'User', createdAt: '2026-10-01T10:00:00Z', lastSignInAt: null, emailConfirmed: true });

describe('AdminUsersService', () => {
  let repo: FakeAdminUsersRepository;
  let service: AdminUsersService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AdminUsersRepository, useClass: FakeAdminUsersRepository }] });
    repo = TestBed.inject(AdminUsersRepository) as FakeAdminUsersRepository;
    repo.users = [user('u1', 'a@example.com'), user('u2', 'b@example.com')];
    service = TestBed.inject(AdminUsersService);
  });

  it('applies an accepted change in the backend and reports it', async () => {
    expect(await service.setEmail('u1', 'new@example.com')).toBe(true);
    expect(await service.setAvatar('u2', 'data:image/jpeg;base64,AAAA')).toBe(true);
    expect(await service.remove('u2')).toBe(true);
    expect(repo.users.map((u) => u.id)).toEqual(['u1']);
    expect(repo.users[0].email).toBe('new@example.com');
    expect(repo.calls).toEqual(['email u1', 'avatar u2', 'delete u2']);
  });

  it('changes nothing and says why when the backend refuses', async () => {
    repo.failing = true;
    expect(await service.remove('u1')).toBe(false);
    expect(await service.setEmail('u1', 'new@example.com')).toBe(false);
    expect(repo.users.map((u) => u.email)).toEqual(['a@example.com', 'b@example.com']);
    expect(TestBed.inject(ToastService).message()).toBeTruthy();
  });

  it('answers not found for a user that is gone', async () => {
    expect(await service.setPassword('nobody', 'Abcdefghi1')).toBe(false);
  });
});

describe('FakeAdminUsersRepository paging', () => {
  it('cuts one page of the matches for the search text', () => {
    const repo = new FakeAdminUsersRepository();
    repo.users = [user('u1', 'a@example.com'), user('u2', 'b@example.com'), user('u3', 'abc@example.com')];
    expect(repo.parse(null, undefined, { page: 1, pageSize: 10, search: 'ab' }).rows.map((u) => u.id)).toEqual(['u3']);
    const page = repo.parse(null, undefined, { page: 2, pageSize: 2, search: '' });
    expect(page.rows.map((u) => u.id)).toEqual(['u3']);
    expect(page.total).toBe(3);
  });
});

describe('AdminUsersService roles', () => {
  let repo: FakeAdminUsersRepository;
  let service: AdminUsersService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AdminUsersRepository, useClass: FakeAdminUsersRepository }] });
    repo = TestBed.inject(AdminUsersRepository) as FakeAdminUsersRepository;
    repo.users = [user('u1', 'a@example.com'), user('u2', 'b@example.com')];
    service = TestBed.inject(AdminUsersService);
  });

  it('loads the roles with the number of accounts that have each', async () => {
    await service.loadRoles();
    expect(service.roles().map((r) => r.id)).toEqual(['admin', 'user']);
    expect(service.roles().find((r) => r.id === 'user')?.users).toBe(2);
  });

  it('creates a role and shows it in the list once the backend accepted it', async () => {
    await service.loadRoles();
    const id = await service.saveRole({ names: { az: 'Müşahidəçi', en: 'Observer' }, descriptions: {}, permissions: ['today.view'] });
    expect(id).toBeTruthy();
    expect(service.roles().some((r) => r.id === id && r.permissions.includes('today.view'))).toBe(true);
  });

  it('refuses to change the administrator role and says why', async () => {
    await service.loadRoles();
    expect(await service.saveRole({ id: 'admin', names: { az: 'x' }, descriptions: {}, permissions: [] })).toBeNull();
    expect(TestBed.inject(ToastService).message()).toBeTruthy();
  });

  it('assigns a role to an account and keeps the list as it was when the backend refuses', async () => {
    await service.loadRoles();
    expect(await service.setRole('u1', 'admin')).toBe(true);
    expect(repo.users[0].roleId).toBe('admin');
    expect(await service.setRole('u2', 'no-such-role')).toBe(false);
    expect(repo.users[1].roleId).toBe('user');
  });

  it('does not delete a built-in role or a role that accounts still have', async () => {
    await service.loadRoles();
    expect(await service.deleteRole('user')).toBe(false);
    const id = (await service.saveRole({ names: { az: 'Yeni' }, descriptions: {}, permissions: [] })) as string;
    await service.setRole('u1', id);
    expect(await service.deleteRole(id)).toBe(false);
    await service.setRole('u1', 'user');
    expect(await service.deleteRole(id)).toBe(true);
    expect(service.roles().some((r) => r.id === id)).toBe(false);
  });
});
