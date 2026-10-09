/** Trainer exercise ids start with this prefix so they never clash with the built-in program's ids. */
export const TRAINER_EX_PREFIX = 't:';
export const trainerExId = (name: string): string => TRAINER_EX_PREFIX + name.trim().toLowerCase().replace(/\s+/g, ' ');
