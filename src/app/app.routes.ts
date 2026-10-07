import { Routes } from '@angular/router';

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

export const routes: Routes = [
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
  { path: '**', redirectTo: '' },
];
