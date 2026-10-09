# Supabase setup (auth)

Rules: `_bmad-output/planning-artifacts/backend-migration-rules.md`. Only the project URL and the publishable key go into the app; never the secret / service_role key or the database password.

## 1. Database

Supabase Dashboard → **SQL Editor** → New query → paste each file in `migrations/` in name order (`..._auth_profiles.sql`, `..._profiles_avatar.sql`, `..._foods.sql`, `..._foods_generator_fields.sql`, `..._foods_position.sql`, `..._food_order_per_user.sql`, `..._profiles_body.sql`, `..._trainer_plans.sql`, `..._profiles_age_sex.sql`, `..._profiles_settings.sql`, `..._profiles_admin.sql`, `..._roles_permissions.sql`, `..._user_data.sql`, `..._food_units.sql`) → Run.
(With the CLI instead: `npx supabase link --project-ref <ref>` then `npx supabase db push`.)

Check RLS afterwards with `tests/rls_profiles_check.sql.txt` (SQL Editor, rolled back at the end).

## 2. Dashboard settings

- **Authentication → URL Configuration**: Site URL = production domain; Redirect URLs =
  `http://localhost:4200/auth/callback`, `http://localhost:4200/auth/reset-password`, and the same two on the production domain.
- **Authentication → Sign In / Providers → Email**: enabled, **Confirm email** on, minimum password length 10, require lower case + upper case + digits (the same rules as `core/auth/auth-validation.ts`).
- **Authentication → Emails**: adapt the Confirm signup and Reset password templates.
- **Authentication → SMTP Settings**: the built-in mailer is capped at a few e-mails per hour, so set a real SMTP provider before real users.
- **Providers → Google**: see below.

## 3. Login function (username or e-mail)

```
npx supabase functions deploy login --no-verify-jwt
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:4200,https://YOUR-DOMAIN"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function by Supabase itself (server side only).
Dashboard → **Edge Functions → login → Logs** shows errors.

## 3b. Users, roles and permissions

Every page and action of the app is a **permission** (`<module>.<action>`, the table `permissions`; the same list is `PERMISSIONS` in
`src/app/common/interfaces/permissions/permissions.ts`). A **role** is a set of permissions, an account has exactly one role
(`profiles.role_id`). Built-in roles: `admin` (everything, cannot be changed or deleted) and `user` (the whole app, no administration; every new
account gets it). More roles are created on the roles page. The pages `/admin/users` (list, change e-mail / password / picture / role, delete)
and `/admin/roles` (create and edit roles) appear in the menu only for roles that hold their `view` permission. They need the service role,
so they run in an Edge Function and never in the browser; the function loads the caller's permissions from the database and checks them on
every call.

Migrations `..._profiles_admin.sql` then `..._roles_permissions.sql` (the second one turns the first version's `is_admin` into the role `admin`).

Deploy the function (CLI: `npx supabase functions deploy admin-users`), or in the browser: **Edge Functions → Deploy a new function → Via Editor**, name it exactly
`admin-users` (it must match `adminUsersFunction` in the environment files), paste the whole of `functions/admin-users/index.ts`, **Deploy** (leave
**Enforce JWT verification** on). **Edge Functions → Secrets**: `ALLOWED_ORIGINS` must hold your app origins (the value `login` uses);
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase. After a change of that file, deploy again.

Nobody can give themselves a role from the app. Make the first administrator in the SQL Editor:

```sql
update public.profiles set role_id = 'admin' where email = 'you@example.com';
```

Rules the function enforces: nobody changes their own role or deletes their own account; the last administrator cannot be removed; only
administrators make or remove administrators; a person can only give a role permissions they hold themselves; the `admin` role and
the built-in roles are not deleted; a role with accounts is not deleted. A new permission = a new row in `permissions` (a migration) AND the id in `PERMISSIONS`,
its texts in `core/i18n/admin.*.json` and, for a page, the guard on its route (`permissionGuard`).

## 4. Angular environment

Fill in `src/environments/environment.ts` (dev) and `environment.prod.ts` (production build): `supabaseUrl` and `supabasePublishableKey` from
**Project Settings → API Keys**, `loginFunction` and `adminUsersFunction` (the slugs in the function URLs) and `siteUrl`. Both files are committed: these values are public.
Left empty, auth is off and the app runs as a guest only.

## 5. Google

Google Cloud Console → OAuth consent screen, then Credentials → OAuth client ID → Web application:
authorized JavaScript origins `http://localhost:4200` and the production domain; authorized redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`. Put Client ID and Client Secret in Supabase → Authentication → Sign In / Providers → Google.

