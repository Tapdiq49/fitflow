import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { supabaseRestInterceptor } from './core/backend/supabase-rest.interceptor';
import { AuthService } from './core/auth/auth.service';
import { SupabaseAuthService } from './core/auth/supabase-auth.service';
import { I18nTitleStrategy } from './core/i18n/title.strategy';
import { FoodCatalogService } from './core/services/food-catalog.service';
import { FoodRepository } from './core/repositories/food.repository';
import { SupabaseFoodRepository } from './core/repositories/supabase-food.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([supabaseRestInterceptor])),
    { provide: TitleStrategy, useExisting: I18nTitleStrategy },
    // The single place that picks the auth backend; a NestJS implementation replaces SupabaseAuthService here.
    { provide: AuthService, useClass: SupabaseAuthService },
    { provide: FoodRepository, useClass: SupabaseFoodRepository },
    // Not awaited: the app opens at once as a guest and updates when the stored session is restored.
    provideAppInitializer(() => {
      void inject(AuthStore).init();
    }),
    // Loads the food list at start: meals on every screen show the food names the backend sends.
    provideAppInitializer(() => {
      inject(FoodCatalogService);
    }),
  ]
};
