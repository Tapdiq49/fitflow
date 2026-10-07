import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { AuthService } from './core/auth/auth.service';
import { SupabaseAuthService } from './core/auth/supabase-auth.service';
import { I18nTitleStrategy } from './core/i18n/title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: I18nTitleStrategy },
    // The single place that picks the auth backend; a NestJS implementation replaces SupabaseAuthService here.
    { provide: AuthService, useClass: SupabaseAuthService },
    // Not awaited: the app opens at once as a guest and updates when the stored session is restored.
    provideAppInitializer(() => {
      void inject(AuthStore).init();
    }),
  ]
};
