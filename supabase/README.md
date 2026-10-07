# Supabase setup (auth)

Rules: `_bmad-output/planning-artifacts/backend-migration-rules.md`. Only the project URL and the publishable key go into the app; never the secret / service_role key or the database password.

## 1. Database

Supabase Dashboard → **SQL Editor** → New query → paste `migrations/20261007000000_auth_profiles.sql` → Run.
(With the CLI instead: `npx supabase link --project-ref <ref>` then `npx supabase db push`.)

Check RLS afterwards with `tests/rls_profiles_check.sql.txt` (SQL Editor, rolled back at the end).

## 2. Dashboard settings

- **Authentication → URL Configuration**: Site URL = production domain; Redirect URLs =
  `http://localhost:4200/auth/callback`, `http://localhost:4200/auth/reset-password`, and the same two on the production domain.
- **Authentication → Sign In / Providers → Email**: enabled, **Confirm email** on, minimum password length 10, require lower case + upper case + digits (the same rules as `core/auth/auth-validation.ts`).
- **Authentication → Emails**: adapt the Confirm signup and Reset password templates.
- **Authentication → SMTP Settings**: the built-in mailer is capped at a few e-mails per hour, so set a real SMTP provider before real users.
- **Providers → Google / Apple**: see below.

## 3. Login function (username or e-mail)

```
npx supabase functions deploy login --no-verify-jwt
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:4200,https://YOUR-DOMAIN"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function by Supabase itself (server side only).
Dashboard → **Edge Functions → login → Logs** shows errors.

## 4. Angular environment

Fill in `src/environments/environment.ts` (dev) and `environment.prod.ts` (production build): `supabaseUrl` and `supabasePublishableKey` from
**Project Settings → API Keys**, `loginFunction` (the slug in the function URL) and `siteUrl`. Both files are committed: these values are public.
Left empty, auth is off and the app runs as a guest only.

## 5. Google

Google Cloud Console → OAuth consent screen, then Credentials → OAuth client ID → Web application:
authorized JavaScript origins `http://localhost:4200` and the production domain; authorized redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`. Put Client ID and Client Secret in Supabase → Authentication → Sign In / Providers → Google.

## 6. Apple

Needs an Apple Developer Program membership. App ID with Sign in with Apple → Services ID (this is the Client ID) with the domain and
return URL `https://<project-ref>.supabase.co/auth/v1/callback` → a Sign in with Apple key (`.p8`, downloadable once). Team ID, Key ID and the
`.p8` content go into Supabase → Providers → Apple. The client secret Apple accepts lives at most 6 months: renew it, or Apple sign-in stops.
Apple does not accept `localhost`; test it on an HTTPS domain.
