import { Routes } from '@angular/router';
import { accountGuard, guestGuard, packGuard, permissionGuard, usernameSetupGuard } from './core/auth/auth.guard';

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
    children: [
      { path: '', title: 'nav.today', canActivate: [permissionGuard('today.view')], loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'workout', title: 'nav.workout', canActivate: [permissionGuard('workout.view')], loadComponent: () => import('./features/workout/workout.page').then((m) => m.WorkoutPage) },
      { path: 'plan', title: 'nav.weeklyPlan', canActivate: [permissionGuard('plan.view', { pack: 'plan' })], loadComponent: () => import('./features/week-plan/week-plan.page').then((m) => m.WeekPlanPage) },
      { path: 'body', title: 'nav.body', canActivate: [permissionGuard('body.view')], loadComponent: () => import('./features/body/body.page').then((m) => m.BodyPage) },
      {
        path: 'supplements',
        title: 'nav.supplements',
        canActivate: [permissionGuard('supplements.view', { pack: 'supp' })],
        loadComponent: () => import('./features/supplements/supplements.page').then((m) => m.SupplementsPage),
      },
      { path: 'calendar', title: 'nav.calendar', canActivate: [permissionGuard('calendar.view')], loadComponent: () => import('./features/calendar/calendar.page').then((m) => m.CalendarPage) },
      { path: 'references', title: 'nav.references', canActivate: [permissionGuard('references.view')], loadComponent: () => import('./features/references/references.page').then((m) => m.ReferencesPage) },
      // One route per list in REFERENCE_LISTS (features/references/reference-lists.ts): path is 'references/<id>'.
      { path: 'references/foods', title: 'references.foods', canActivate: [permissionGuard('references.view')], loadComponent: () => import('./features/references/food-references.page').then((m) => m.FoodReferencesPage) },
      { path: 'profile', title: 'profile.title', canActivate: [accountGuard, permissionGuard('profile.view')], loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage) },
      { path: 'admin/users', title: 'nav.users', canActivate: [permissionGuard('users.view', { pack: 'admin' })], loadComponent: () => import('./features/admin/users.page').then((m) => m.UsersPage) },
      { path: 'admin/roles', title: 'nav.roles', canActivate: [permissionGuard('roles.view', { pack: 'admin' })], loadComponent: () => import('./features/admin/roles.page').then((m) => m.RolesPage) },
      { path: 'no-access', title: 'noAccess.title', canActivate: [packGuard('admin')], loadComponent: () => import('./features/no-access/no-access.page').then((m) => m.NoAccessPage) },
      { path: 'settings', title: 'nav.settings', canActivate: [permissionGuard('settings.view')], loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
