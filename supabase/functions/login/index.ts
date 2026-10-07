// Edge Function `login`: sign in with an e-mail address OR a username.
//
// Why a function: the username -> e-mail lookup must not be callable by the public (it would let anyone
// read e-mails by username). The browser sends { identifier, password }; the e-mail never leaves the server and
// only a session comes back. Unknown user and wrong password give the same answer.
// NestJS equivalent: `POST /auth/login` with the same body and response.
//
// Deploy:  npx supabase functions deploy login --no-verify-jwt
// Secrets: ALLOWED_ORIGINS="http://localhost:4200,https://your.domain" (SUPABASE_URL, SUPABASE_ANON_KEY and
//          SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function; they are never sent to the browser.)
import { createClient } from 'npm:@supabase/supabase-js@2';

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_IDENTIFIER = 8;
const MAX_FAILURES_PER_IP = 30;

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const corsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const reply = (origin: string | null, status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

const sha256 = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

const failuresSince = async (key: string): Promise<number> => {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin.from('login_attempts').select('id', { count: 'exact', head: true }).eq('key', key).gte('attempted_at', since);
  return count ?? 0;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(origin, 405, { error: 'unknown' });
  if (!origin || !allowedOrigins.includes(origin)) return reply(origin, 403, { error: 'unknown' });

  let identifier = '';
  let password = '';
  try {
    const body = (await req.json()) as { identifier?: unknown; password?: unknown };
    identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return reply(origin, 400, { error: 'invalid_credentials' });
  }
  if (!identifier || !password || identifier.length > 254 || password.length > 256) return reply(origin, 400, { error: 'invalid_credentials' });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const idKey = await sha256(`id:${identifier}`);
  const ipKey = await sha256(`ip:${ip}`);
  if ((await failuresSince(idKey)) >= MAX_FAILURES_PER_IDENTIFIER || (await failuresSince(ipKey)) >= MAX_FAILURES_PER_IP) {
    return reply(origin, 429, { error: 'rate_limited' });
  }

  // Resolve the e-mail. For an unknown username we still run a sign-in with a throw-away address so the
  // response time does not tell whether the username exists.
  let email = identifier;
  if (!identifier.includes('@')) {
    const { data } = await admin.from('profiles').select('email').eq('username', identifier).maybeSingle();
    email = data?.email ?? `unknown-${crypto.randomUUID()}@invalid.example`;
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    if (error?.code === 'email_not_confirmed') return reply(origin, 401, { error: 'email_not_confirmed' });
    await admin.from('login_attempts').insert([{ key: idKey }, { key: ipKey }]);
    // Opportunistic clean-up keeps the table small without a scheduled job.
    await admin.from('login_attempts').delete().lt('attempted_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    return reply(origin, 401, { error: 'invalid_credentials' });
  }

  return reply(origin, 200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
