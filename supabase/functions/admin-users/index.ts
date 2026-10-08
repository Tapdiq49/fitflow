// Edge Function `admin-users`: user, role and permission management.
//
// Why a function: listing every account, changing a stranger's e-mail or password and editing roles needs the service_role key, which must
// never reach the browser. The browser sends its normal session token; this function loads the caller's permissions from the database
// (their role's rows in `role_permissions`) and refuses every action the caller has no permission for.
// NestJS equivalent: controllers behind a permission guard with the same body and responses.
//
// Deploy:  npx supabase functions deploy admin-users   (or paste this file into Dashboard -> Edge Functions -> Via Editor)
//          Leave "Enforce JWT verification" on; the permission checks below are on top of it.
// Secrets: ALLOWED_ORIGINS (shared with the `login` function). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Request:  POST { action, ...params } with `Authorization: Bearer <session access token>`
//   action          params                                   permission              answer
//   list            -                                        users.view              { users: AdminUser[] }
//   delete          { id }                                   users.delete            { ok }
//   set_email       { id, email }                            users.edit_email        { ok }
//   set_password    { id, password }                         users.edit_password     { ok }
//   set_avatar      { id, avatar | null }                    users.edit_avatar       { ok }  (JPEG data URL)
//   set_role        { id, role }                             users.assign_role       { ok }
//   roles           -                                        roles.view / users.view { permissions, roles }
//   save_role       { id?, name, description, permissions }  roles.create / roles.edit   { ok, id }
//   delete_role     { id }                                   roles.delete            { ok }
// Errors: { error: <code> } with the codes the app maps in core/auth/supabase-errors.ts.
// A caller can only give a role permissions they hold themselves (the `admin` role may give any), so editing roles never lifts anybody
// above their own level. The `admin` role cannot be edited or deleted, nobody changes their own role or deletes themselves, and the
// last administrator cannot be removed.
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const ADMIN_ROLE = 'admin';
const MAX_USERS = 1000;
const PER_PAGE = 200;
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_ID = /^[a-z0-9_]{2,30}$/;

const corsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const reply = (origin: string | null, status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

class Failure extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

interface Caller {
  id: string;
  roleId: string;
  permissions: Set<string>;
}

/** The signed-in caller with the permissions of their role; throws 401 without a valid session. */
const loadCaller = async (req: Request): Promise<Caller> => {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) throw new Failure(401, 'session_expired');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Failure(401, 'session_expired');
  const { data: profile } = await admin.from('profiles').select('role_id').eq('id', data.user.id).maybeSingle();
  if (!profile) throw new Failure(403, 'forbidden');
  const { data: rows } = await admin.from('role_permissions').select('permission_id').eq('role_id', profile.role_id);
  return { id: data.user.id, roleId: profile.role_id as string, permissions: new Set((rows ?? []).map((r) => r.permission_id as string)) };
};

const need = (caller: Caller, permission: string): void => {
  if (!caller.permissions.has(permission)) throw new Failure(403, 'forbidden');
};

const textOf = (v: unknown, max: number): string => (typeof v === 'string' && v.length <= max ? v : '');

const idOf = (v: unknown): string => {
  const id = textOf(v, 36);
  if (!UUID.test(id)) throw new Failure(400, 'not_found');
  return id;
};

const countAdmins = async (): Promise<number> => {
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', ADMIN_ROLE);
  return count ?? 0;
};

const roleOf = async (userId: string): Promise<string | null> => {
  const { data } = await admin.from('profiles').select('role_id').eq('id', userId).maybeSingle();
  return (data?.role_id as string | undefined) ?? null;
};

/** Every account with its profile. Accounts are read page by page (the Auth API pages), capped at MAX_USERS. */
const listUsers = async (): Promise<Record<string, unknown>[]> => {
  const accounts: { id: string; email?: string; created_at: string; last_sign_in_at?: string; email_confirmed_at?: string }[] = [];
  for (let page = 1; accounts.length < MAX_USERS; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Failure(500, 'unknown');
    accounts.push(...data.users);
    if (data.users.length < PER_PAGE) break;
  }
  const { data: profiles, error } = await admin.from('profiles').select('id, username, avatar, role_id');
  if (error) throw new Failure(500, 'unknown');
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return accounts.slice(0, MAX_USERS).map((a) => {
    const p = byId.get(a.id);
    return {
      id: a.id,
      email: a.email ?? '',
      username: p?.username ?? null,
      avatar: p?.avatar ?? null,
      roleId: p?.role_id ?? 'user',
      createdAt: a.created_at,
      lastSignInAt: a.last_sign_in_at ?? null,
      emailConfirmed: !!a.email_confirmed_at,
    };
  });
};

/** The permission catalog and every role with its permissions and the number of accounts that have it. */
const listRoles = async (): Promise<Record<string, unknown>> => {
  const [permissions, roles, links] = await Promise.all([
    admin.from('permissions').select('id, module, action, sort').order('sort'),
    admin.from('roles').select('id, name, description, is_system, created_at').order('created_at'),
    admin.from('role_permissions').select('role_id, permission_id'),
  ]);
  if (permissions.error || roles.error || links.error) throw new Failure(500, 'unknown');
  const byRole = new Map<string, string[]>();
  for (const l of links.data ?? []) byRole.set(l.role_id as string, [...(byRole.get(l.role_id as string) ?? []), l.permission_id as string]);
  const counts = await Promise.all(
    (roles.data ?? []).map(async (r) => {
      const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', r.id);
      return count ?? 0;
    }),
  );
  return {
    permissions: permissions.data,
    roles: (roles.data ?? []).map((r, i) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.is_system,
      permissions: byRole.get(r.id as string) ?? [],
      users: counts[i],
    })),
  };
};

/** The permission ids of the request that exist in the catalog, without duplicates; throws when one is unknown. */
const checkedPermissions = async (value: unknown): Promise<string[]> => {
  if (!Array.isArray(value) || value.length > 200) throw new Failure(400, 'invalid_role');
  const ids = [...new Set(value.map((v) => textOf(v, 60)))];
  if (ids.some((id) => !id)) throw new Failure(400, 'invalid_role');
  const { data, error } = await admin.from('permissions').select('id');
  if (error) throw new Failure(500, 'unknown');
  const known = new Set((data ?? []).map((p) => p.id as string));
  if (ids.some((id) => !known.has(id))) throw new Failure(400, 'invalid_role');
  return ids;
};

const saveRole = async (caller: Caller, body: Record<string, unknown>): Promise<string> => {
  const isNew = body.id === undefined || body.id === null || body.id === '';
  const id = isNew ? `r${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}` : textOf(body.id, 30);
  if (!ROLE_ID.test(id)) throw new Failure(400, 'not_found');
  need(caller, isNew ? 'roles.create' : 'roles.edit');
  if (id === ADMIN_ROLE) throw new Failure(400, 'system_role');
  const name = textOf(body.name, 60).trim();
  const description = textOf(body.description ?? '', 200).trim();
  if (!name) throw new Failure(400, 'invalid_role');
  const wanted = await checkedPermissions(body.permissions);
  // Nobody hands out more than they hold (the administrator role holds everything, so it may hand out anything).
  if (caller.roleId !== ADMIN_ROLE && wanted.some((p) => !caller.permissions.has(p))) throw new Failure(403, 'forbidden');

  if (isNew) {
    const { error } = await admin.from('roles').insert({ id, name, description, is_system: false });
    if (error) throw new Failure(500, 'unknown');
  } else {
    const { data, error } = await admin.from('roles').update({ name, description }).eq('id', id).select('id');
    if (error) throw new Failure(500, 'unknown');
    if (!data?.length) throw new Failure(404, 'not_found');
  }

  const { data: current } = await admin.from('role_permissions').select('permission_id').eq('role_id', id);
  const have = new Set((current ?? []).map((r) => r.permission_id as string));
  const remove = [...have].filter((p) => !wanted.includes(p));
  const add = wanted.filter((p) => !have.has(p));
  if (remove.length) {
    const { error } = await admin.from('role_permissions').delete().eq('role_id', id).in('permission_id', remove);
    if (error) throw new Failure(500, 'unknown');
  }
  if (add.length) {
    const { error } = await admin.from('role_permissions').insert(add.map((permission_id) => ({ role_id: id, permission_id })));
    if (error) throw new Failure(500, 'unknown');
  }
  return id;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(origin, 405, { error: 'unknown' });
  if (!origin || !allowedOrigins.includes(origin)) return reply(origin, 403, { error: 'forbidden' });

  try {
    const caller = await loadCaller(req);
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return reply(origin, 400, { error: 'unknown' });
    }

    switch (body.action) {
      case 'list':
        need(caller, 'users.view');
        return reply(origin, 200, { users: await listUsers() });

      case 'delete': {
        need(caller, 'users.delete');
        const id = idOf(body.id);
        if (id === caller.id) throw new Failure(400, 'self_action');
        if ((await roleOf(id)) === ADMIN_ROLE && (await countAdmins()) <= 1) throw new Failure(400, 'self_action');
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw new Failure(error.status === 404 ? 404 : 500, error.status === 404 ? 'not_found' : 'unknown');
        return reply(origin, 200, { ok: true });
      }

      case 'set_email': {
        need(caller, 'users.edit_email');
        const id = idOf(body.id);
        const email = textOf(body.email, 254).trim().toLowerCase();
        if (!EMAIL.test(email)) throw new Failure(400, 'invalid_email');
        const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
        if (error) {
          if (error.code === 'email_exists') throw new Failure(409, 'email_exists');
          throw new Failure(error.status === 404 ? 404 : 400, error.status === 404 ? 'not_found' : 'invalid_email');
        }
        // The profile keeps a copy of the e-mail (login by username looks it up there).
        await admin.from('profiles').update({ email }).eq('id', id);
        return reply(origin, 200, { ok: true });
      }

      case 'set_password': {
        need(caller, 'users.edit_password');
        const id = idOf(body.id);
        const password = textOf(body.password, PASSWORD_MAX);
        if (password.length < PASSWORD_MIN || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new Failure(400, 'weak_password');
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) throw new Failure(error.status === 404 ? 404 : 400, error.status === 404 ? 'not_found' : (error.code ?? 'weak_password'));
        return reply(origin, 200, { ok: true });
      }

      case 'set_avatar': {
        need(caller, 'users.edit_avatar');
        const id = idOf(body.id);
        const avatar = body.avatar === null ? null : textOf(body.avatar, 60000);
        if (avatar !== null && !avatar.startsWith('data:image/jpeg;base64,')) throw new Failure(400, 'invalid_image');
        const { data, error } = await admin.from('profiles').update({ avatar }).eq('id', id).select('id');
        if (error) throw new Failure(400, 'invalid_image');
        if (!data?.length) throw new Failure(404, 'not_found');
        return reply(origin, 200, { ok: true });
      }

      case 'set_role': {
        need(caller, 'users.assign_role');
        const id = idOf(body.id);
        const role = textOf(body.role, 30);
        if (id === caller.id) throw new Failure(400, 'self_action');
        const { data: exists } = await admin.from('roles').select('id').eq('id', role).maybeSingle();
        if (!exists) throw new Failure(400, 'invalid_role');
        const before = await roleOf(id);
        if (before === null) throw new Failure(404, 'not_found');
        if (before === ADMIN_ROLE && role !== ADMIN_ROLE && (await countAdmins()) <= 1) throw new Failure(400, 'self_action');
        // Making somebody an administrator is the administrators' business only.
        if ((role === ADMIN_ROLE || before === ADMIN_ROLE) && caller.roleId !== ADMIN_ROLE) throw new Failure(403, 'forbidden');
        const { error } = await admin.from('profiles').update({ role_id: role }).eq('id', id);
        if (error) throw new Failure(500, 'unknown');
        return reply(origin, 200, { ok: true });
      }

      case 'roles':
        // Also what the user list needs to show and pick roles.
        if (!['roles.view', 'users.view', 'users.assign_role'].some((p) => caller.permissions.has(p))) throw new Failure(403, 'forbidden');
        return reply(origin, 200, await listRoles());

      case 'save_role':
        return reply(origin, 200, { ok: true, id: await saveRole(caller, body) });

      case 'delete_role': {
        need(caller, 'roles.delete');
        const id = textOf(body.id, 30);
        if (!ROLE_ID.test(id)) throw new Failure(400, 'not_found');
        const { data: role } = await admin.from('roles').select('is_system').eq('id', id).maybeSingle();
        if (!role) throw new Failure(404, 'not_found');
        if (role.is_system) throw new Failure(400, 'system_role');
        const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', id);
        if ((count ?? 0) > 0) throw new Failure(400, 'role_in_use');
        const { error } = await admin.from('roles').delete().eq('id', id);
        if (error) throw new Failure(500, 'unknown');
        return reply(origin, 200, { ok: true });
      }

      default:
        return reply(origin, 400, { error: 'unknown' });
    }
  } catch (e) {
    if (e instanceof Failure) return reply(origin, e.status, { error: e.code });
    return reply(origin, 500, { error: 'unknown' });
  }
});
