import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Requests to the Supabase REST API (`httpResource` reads) carry the project key and, for a signed-in user, the session token,
 * so row level security sees who is asking. The token is read when the request starts (the session may have refreshed),
 * and a request cancelled before that never leaves.
 */
export const supabaseRestInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.supabaseUrl;
  if (!base || !req.url.startsWith(`${base}/rest/v1/`)) return next(req);
  const auth = inject(AuthService);
  return from(auth.accessToken()).pipe(
    switchMap((token) => {
      const headers: Record<string, string> = { apikey: environment.supabasePublishableKey };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return next(req.clone({ setHeaders: headers }));
    }),
  );
};
