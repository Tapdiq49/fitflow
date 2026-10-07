/**
 * Supabase connection for the dev build. `environment.prod.ts` is swapped in by angular.json for the production build.
 * Only the project URL and the publishable (anon) key belong here; both are public by design.
 * The secret / service_role key must never be put in this app.
 */
export const environment = {
  /** https://<project-ref>.supabase.co ; empty = auth is off and the app runs as a guest only. */
  supabaseUrl: 'https://qrfvuyozvpxfljsoywbo.supabase.co',
  supabasePublishableKey: 'sb_publishable_IhBojwEsL4ha1Dptt9WDHA_u4W9Rrbm',
  /** Where the browser returns to after OAuth / e-mail links. Must be in Supabase → Authentication → URL Configuration. */
  /** Slug of the login Edge Function (the last part of its URL in the Supabase dashboard). */
  loginFunction: 'login',
  siteUrl: 'https://YOUR-DOMAIN',
};
