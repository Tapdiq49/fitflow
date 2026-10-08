import { TestBed } from '@angular/core/testing';
import { APP_PERMISSIONS, PERMISSIONS, PERMISSION_GROUPS, isAdminPermission } from '../../common/interfaces';
import { AuthUser } from '../../common/interfaces/auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { FakeAuthService } from '../auth/fake-auth.service';
import { PermissionService } from './permission.service';

const USER: AuthUser = { id: 'u1', email: 'a@example.com', username: 'john', emailPreferences: false, avatar: null, height: null, startWeight: null, age: null, sex: null, settings: null, roleId: 'user', permissions: null, hasPassword: true };

describe('PermissionService', () => {
  let fake: FakeAuthService;
  let perms: PermissionService;
  const signIn = async (user: Partial<AuthUser>): Promise<void> => {
    fake.stored = { ...USER, ...user };
    await TestBed.inject(AuthStore).init();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useClass: FakeAuthService }] });
    fake = TestBed.inject(AuthService) as FakeAuthService;
    perms = TestBed.inject(PermissionService);
  });

  it('gives a guest the whole app and no administration', async () => {
    await TestBed.inject(AuthStore).init();
    for (const p of APP_PERMISSIONS) expect(perms.can(p), p).toBe(true);
    expect(perms.can('users.view')).toBe(false);
    expect(perms.can('roles.edit')).toBe(false);
  });

  it('gives an account exactly what its role holds', async () => {
    await signIn({ roleId: 'viewer', permissions: ['today.view', 'workout.view'] });
    expect(perms.can('today.view')).toBe(true);
    expect(perms.can('today.edit')).toBe(false);
    expect(perms.can('settings.view')).toBe(false);
  });

  it('falls back to the default role when the permissions of the account could not be read', async () => {
    await signIn({ permissions: null });
    expect(perms.can('workout.edit')).toBe(true);
    expect(perms.can('users.view')).toBe(false);
  });

  it('lets an administrator role with every permission open the administration', async () => {
    await signIn({ roleId: 'admin', permissions: [...PERMISSIONS] });
    expect(perms.can('users.delete')).toBe(true);
    expect(perms.can('roles.create')).toBe(true);
  });
});

describe('permission catalog', () => {
  it('has unique ids of the form module.action', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    for (const p of PERMISSIONS) expect(p).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('keeps administration out of the app permissions, and groups every permission once', () => {
    expect(APP_PERMISSIONS.some((p) => isAdminPermission(p))).toBe(false);
    expect(PERMISSION_GROUPS.flatMap((g) => g.permissions)).toEqual([...PERMISSIONS]);
  });
});
