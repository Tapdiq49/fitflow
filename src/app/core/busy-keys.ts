/**
 * Names for `DataSyncService.busy()` / `<... [appBusy]="key">`: one key per thing the user can change, so the control that was
 * clicked (and any other control for the same thing) shows a loader while the change waits for the backend.
 * The timeline item "breakfast", the breakfast button in the meal list and `DayService.toggleMeal` share one key on purpose.
 */
export const BUSY = {
  /** A checklist item of a day: `meal:<mealId>`, `creatine`, `cardio`, `workout`, `walk`, `mobility`, `sleep`. */
  toggle: (day: string, itemId: string): string => `toggle:${day}:${itemId}`,
  /** One key per water button: `250`, `500`, `custom`, `undo`. */
  water: (day: string, source: string | number): string => `water:${day}:${source}`,
  sleep: (day: string, field: 'bed' | 'wake'): string => `sleep:${day}:${field}`,
  /** The cardio type and minutes. */
  cardio: (day: string): string => `cardio:${day}`,
  /** One meal: `swap`, `remove`. */
  meal: (day: string, mealId: string, action: 'swap' | 'remove'): string => `meal:${day}:${mealId}:${action}`,
  /** The day's whole menu: new menu, new day plan, an added meal or whey. */
  menu: (day: string): string => `menu:${day}`,
  workoutStart: (day: string): string => `workout-start:${day}`,
  /** The workout times typed in (trainer mode). */
  workoutTime: (day: string, field: 'startTime' | 'endTime'): string => `workout-time:${day}:${field}`,
  exercise: (day: string, exerciseId: string): string => `exercise:${day}:${exerciseId}`,
  /** The check box of a set (done, remove). */
  set: (day: string, exerciseId: string, index: number): string => `set:${day}:${exerciseId}:${index}`,
  /** The weight / reps field of a set. Not the key of the check box: tapping the check box right after typing blurs the field, and a busy check box would swallow that tap. */
  setField: (day: string, exerciseId: string, index: number, field: 'w' | 'r'): string => `set-field:${day}:${exerciseId}:${index}:${field}`,
  /** Adding a set to an exercise. */
  addSet: (day: string, exerciseId: string): string => `add-set:${day}:${exerciseId}`,
  /** Saving or removing a weight entry. */
  weight: (day: string): string => `weight:${day}`,
} as const;
