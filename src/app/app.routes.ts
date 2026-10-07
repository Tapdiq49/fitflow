import { Routes } from '@angular/router';
import { guestGuard, usernameGuard, usernameSetupGuard } from './core/auth/auth.guard';

export interface NavItem {
  path: string;
  icon: string;
  label: string;
}

export const NAV: NavItem[] = [
  { path: '/', icon: 'home', label: 'nav.today' },
  { path: '/workout', icon: 'dumbbell', label: 'nav.workout' },
  { path: '/plan', icon: 'utensils', label: 'nav.weeklyPlan' },
  { path: '/body', icon: 'scale', label: 'nav.body' },
  { path: '/supplements', icon: 'pill', label: 'nav.supplements' },
  { path: '/calendar', icon: 'calendar', label: 'nav.calendar' },
  { path: '/references', icon: 'book', label: 'nav.references' },
  { path: '/settings', icon: 'settings', label: 'nav.settings' },
];

/** Auth pages live outside the app shell and are all optional: the app works for guests too. */
export const routes: Routes = [
  {
    path: 'auth',
    children: [
      { path: 'sign-in', title: 'auth.signIn', canActivate: [guestGuard], loadComponent: () => import('./features/auth/sign-in.page').then((m) => m.SignInPage) },
      { path: 'sign-up', title: 'auth.signUp', canActivate: [guestGuard], loadComponent: () => import('./features/auth/sign-up.page').then((m) => m.SignUpPage) },
      { path: 'forgot-password', title: 'auth.forgotPasswordTitle', loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage) },
      { path: 'reset-password', title: 'auth.resetPasswordTitle', loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage) },
      { path: 'callback', title: 'auth.signIn', loadComponent: () => import('./features/auth/auth-callback.page').then((m) => m.AuthCallbackPage) },
      { path: 'username', title: 'auth.chooseUsernameTitle', canActivate: [usernameSetupGuard], loadComponent: () => import('./features/auth/username-setup.page').then((m) => m.UsernameSetupPage) },
      { path: '', pathMatch: 'full', redirectTo: 'sign-in' },
    ],
  },
  {
    path: '',
    canActivateChild: [usernameGuard],
    children: [
      { path: '', title: 'nav.today', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'workout', title: 'nav.workout', loadComponent: () => import('./features/workout/workout.page').then((m) => m.WorkoutPage) },
      { path: 'plan', title: 'nav.weeklyPlan', loadComponent: () => import('./features/week-plan/week-plan.page').then((m) => m.WeekPlanPage) },
      { path: 'body', title: 'nav.body', loadComponent: () => import('./features/body/body.page').then((m) => m.BodyPage) },
      {
        path: 'supplements',
        title: 'nav.supplements',
        loadComponent: () => import('./features/supplements/supplements.page').then((m) => m.SupplementsPage),
      },
      { path: 'calendar', title: 'nav.calendar', loadComponent: () => import('./features/calendar/calendar.page').then((m) => m.CalendarPage) },
      { path: 'references', title: 'nav.references', loadComponent: () => import('./features/references/references.page').then((m) => m.ReferencesPage) },
      // One route per list in REFERENCE_LISTS (features/references/reference-lists.ts): path is 'references/<id>'.
      { path: 'references/foods', title: 'references.foods', loadComponent: () => import('./features/references/food-references.page').then((m) => m.FoodReferencesPage) },
      { path: 'settings', title: 'nav.settings', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
