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
//   list            GET ?page=&pageSize=&search=&lang=  (no body)  users.view              { users: AdminUser[], total }  (one page; search from 3 chars on)
//                   (POST { action: 'list', page, pageSize, search } works too; every other action is a POST)
//   delete          { id }                                   users.delete            { ok }
//   set_email       { id, email }                            users.edit_email        { ok }
//   set_password    { id, password }                         users.edit_password     { ok }
//   set_avatar      { id, avatar | null }                    users.edit_avatar       { ok }  (JPEG data URL)
//   set_role        { id, role }                             users.assign_role       { ok }
//   roles           GET ?resource=roles&lang=                roles.view / users.view { permissions, roles }  (POST { action: 'roles' } works too)
//   save_role       { id?, names, descriptions, permissions }  roles.create / roles.edit   { ok, id }
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
const PAGE_SIZES = [10, 50, 100];
const MIN_SEARCH = 3;
const LANGS = ['az', 'en', 'ru'];

// A role has its name and description in the three languages (`names`, `descriptions`); the request names the language it wants (`lang`: az,
// en or ru; az when missing). A language without a text falls back to Azerbaijani, then to the stored `name` / `description`.
const langOf = (v: unknown): string => (typeof v === 'string' && LANGS.includes(v) ? v : LANGS[0]);
const textIn = (texts: unknown, lang: string, stored: string): string => {
  const t = (texts ?? {}) as Record<string, unknown>;
  const pick = (l: string): string => (typeof t[l] === 'string' ? (t[l] as string) : '');
  return pick(lang) || pick(LANGS[0]) || stored;
};
// The texts of a request: only the known languages, trimmed and cut to max; empty ones are left out.
const textsOf = (v: unknown, max: number): Record<string, string> => {
  const out: Record<string, string> = {};
  const src = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  for (const l of LANGS) {
    const text = typeof src[l] === 'string' ? (src[l] as string).trim() : '';
    if (text.length > max) throw new Failure(400, 'invalid_role');
    if (text) out[l] = text;
  }
  return out;
};
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_ID = /^[a-z0-9_]{2,30}$/;

const corsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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

/**
 * One page of accounts. The search and the paging run in the database on `profiles` (e-mail and username, case-insensitive,
 * oldest first); the sign-in dates and the confirmation come from the Auth API for the accounts of this page only.
 */
const listUsers = async (body: Record<string, unknown>): Promise<{ users: Record<string, unknown>[]; total: number }> => {
  const page = Number.isInteger(body.page) && (body.page as number) >= 1 ? (body.page as number) : 1;
  const pageSize = PAGE_SIZES.includes(body.pageSize as number) ? (body.pageSize as number) : PAGE_SIZES[0];
  const search = textOf(body.search ?? '', 100).trim();
  const lang = langOf(body.lang);
  let query = admin.from('profiles').select('id, email, username, avatar, role_id, created_at', { count: 'exact' });
  if (search.length >= MIN_SEARCH) {
    // Characters with a meaning in a PostgREST filter or in LIKE are dropped / escaped, so the text is only ever a needle.
    const needle = search.replace(/[,()"\\*]/g, ' ').replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(`email.ilike.%${needle}%,username.ilike.%${needle}%`);
  }
  const from = (page - 1) * pageSize;
  const { data: profiles, count, error } = await query.order('created_at', { ascending: true }).order('id').range(from, from + pageSize - 1);
  if (error) throw new Failure(500, 'unknown');
  const { data: roleRows } = await admin.from('roles').select('id, name, names');
  const roleNames = new Map((roleRows ?? []).map((r) => [r.id as string, textIn(r.names, lang, r.name as string)]));
  const accounts = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id as string);
      return data.user;
    }),
  );
  return {
    total: count ?? 0,
    users: (profiles ?? []).map((p, i) => {
      const a = accounts[i];
      return {
        id: p.id,
        email: a?.email ?? p.email ?? '',
        username: p.username ?? null,
        avatar: p.avatar ?? null,
        roleId: p.role_id ?? 'user',
        roleName: roleNames.get(p.role_id as string) ?? (p.role_id as string),
        createdAt: a?.created_at ?? p.created_at,
        lastSignInAt: a?.last_sign_in_at ?? null,
        emailConfirmed: !!a?.email_confirmed_at,
      };
    }),
  };
};

/** The permission catalog and every role with its permissions and the number of accounts that have it. */
const listRoles = async (lang: string): Promise<Record<string, unknown>> => {
  const [permissions, roles, links] = await Promise.all([
    admin.from('permissions').select('id, module, action, sort').order('sort'),
    admin.from('roles').select('id, name, description, names, descriptions, is_system, created_at').order('created_at'),
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
      name: textIn(r.names, lang, r.name as string),
      description: textIn(r.descriptions, lang, r.description as string),
      names: r.names,
      descriptions: r.descriptions,
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
  const names = textsOf(body.names, 60);
  const descriptions = textsOf(body.descriptions, 200);
  // `name` / `description` keep the Azerbaijani text (the source language and the fallback), or the first one that was written.
  const name = names.az ?? Object.values(names)[0] ?? '';
  const description = descriptions.az ?? Object.values(descriptions)[0] ?? '';
  if (!name) throw new Failure(400, 'invalid_role');
  const wanted = await checkedPermissions(body.permissions);
  // Nobody hands out more than they hold (the administrator role holds everything, so it may hand out anything).
  if (caller.roleId !== ADMIN_ROLE && wanted.some((p) => !caller.permissions.has(p))) throw new Failure(403, 'forbidden');

  if (isNew) {
    const { error } = await admin.from('roles').insert({ id, name, description, names, descriptions, is_system: false });
    if (error) throw new Failure(500, 'unknown');
  } else {
    const { data, error } = await admin.from('roles').update({ name, description, names, descriptions }).eq('id', id).select('id');
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
  if (req.method !== 'POST' && req.method !== 'GET') return reply(origin, 405, { error: 'unknown' });
  if (!origin || !allowedOrigins.includes(origin)) return reply(origin, 403, { error: 'forbidden' });

  try {
    const caller = await loadCaller(req);
    let body: Record<string, unknown>;
    if (req.method === 'GET') {
      // Reads are GET like the REST lists: GET ?page=&pageSize=&search= is the user list, GET ?resource=roles the roles.
      const q = new URL(req.url).searchParams;
      if (q.get('resource') === 'roles') body = { action: 'roles', lang: q.get('lang') };
      else body = { action: 'list', page: Number(q.get('page') ?? 1), pageSize: Number(q.get('pageSize') ?? PAGE_SIZES[0]), search: q.get('search') ?? '', lang: q.get('lang') };
    } else {
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return reply(origin, 400, { error: 'unknown' });
      }
    }

    switch (body.action) {
      case 'list':
        need(caller, 'users.view');
        return reply(origin, 200, await listUsers(body));

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
        // Another account with this e-mail: answered before the Auth API is asked (its error code for it is not always the same).
        const { data: taken } = await admin.from('profiles').select('id').ilike('email', email.replace(/[%_\\]/g, (c) => `\\${c}`)).neq('id', id).limit(1);
        if (taken?.length) throw new Failure(409, 'email_exists');
        const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
        if (error) {
          if (error.status === 404) throw new Failure(404, 'not_found');
          if (error.code === 'email_exists' || error.code === 'user_already_exists' || /already (been )?registered|already exists/i.test(error.message)) throw new Failure(409, 'email_exists');
          if (error.code === 'email_address_invalid' || error.code === 'validation_failed') throw new Failure(400, 'invalid_email');
          throw new Failure(500, 'unknown');
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
        return reply(origin, 200, await listRoles(langOf(body.lang)));

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
