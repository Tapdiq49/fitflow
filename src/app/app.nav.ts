import { PermissionId } from './common/interfaces';

export interface NavItem {
  path: string;
  icon: string;
  label: string;
  /** What a person needs to see this entry and open the page. */
  permission: PermissionId;
}

export const NAV: NavItem[] = [
  { path: '/', icon: 'home', label: 'nav.today', permission: 'today.view' },
  { path: '/workout', icon: 'dumbbell', label: 'nav.workout', permission: 'workout.view' },
  { path: '/plan', icon: 'utensils', label: 'nav.weeklyPlan', permission: 'plan.view' },
  { path: '/body', icon: 'scale', label: 'nav.body', permission: 'body.view' },
  { path: '/supplements', icon: 'pill', label: 'nav.supplements', permission: 'supplements.view' },
  { path: '/calendar', icon: 'calendar', label: 'nav.calendar', permission: 'calendar.view' },
  { path: '/references', icon: 'book', label: 'nav.references', permission: 'references.view' },
  { path: '/admin/users', icon: 'users', label: 'nav.users', permission: 'users.view' },
  { path: '/admin/roles', icon: 'shield', label: 'nav.roles', permission: 'roles.view' },
  { path: '/settings', icon: 'settings', label: 'nav.settings', permission: 'settings.view' },
];
