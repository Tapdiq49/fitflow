import { Routes } from '@angular/router';

export interface NavItem {
  path: string;
  icon: string;
  label: string;
}

export const NAV: NavItem[] = [
  { path: '/', icon: 'home', label: 'Bugün' },
  { path: '/workout', icon: 'dumbbell', label: 'Məşq' },
  { path: '/body', icon: 'scale', label: 'Bədən' },
  { path: '/digestion', icon: 'leaf', label: 'Həzm' },
  { path: '/supplements', icon: 'pill', label: 'Supplements' },
  { path: '/calendar', icon: 'calendar', label: 'Təqvim' },
  { path: '/settings', icon: 'settings', label: 'Ayarlar' },
];

export const routes: Routes = [
  { path: '', title: 'FitFlow — Bugün', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
  { path: 'workout', title: 'FitFlow — Məşq', loadComponent: () => import('./features/workout/workout.page').then((m) => m.WorkoutPage) },
  { path: 'body', title: 'FitFlow — Bədən', loadComponent: () => import('./features/body/body.page').then((m) => m.BodyPage) },
  { path: 'digestion', title: 'FitFlow — Həzm', loadComponent: () => import('./features/digestion/digestion.page').then((m) => m.DigestionPage) },
  {
    path: 'supplements',
    title: 'FitFlow — Supplements',
    loadComponent: () => import('./features/supplements/supplements.page').then((m) => m.SupplementsPage),
  },
  { path: 'calendar', title: 'FitFlow — Təqvim', loadComponent: () => import('./features/calendar/calendar.page').then((m) => m.CalendarPage) },
  { path: 'settings', title: 'FitFlow — Ayarlar', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: '' },
];
