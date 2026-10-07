/** Client-side input rules. The same rules are enforced by Supabase (password) and the database (username). */

export const PASSWORD_MIN_LENGTH = 10;

const USERNAME = /^[a-z0-9_.]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmail = (v: string): boolean => v.length <= 254 && EMAIL.test(v.trim());

export const normalizeUsername = (v: string): string => v.trim().toLowerCase();

/** 3–30 letters, digits, "_" or "."; no "@", so it can never be mistaken for an e-mail at login. */
export const isValidUsername = (v: string): boolean => USERNAME.test(normalizeUsername(v));

/** At least 10 characters with a lower-case letter, an upper-case letter and a digit. */
export const isStrongPassword = (v: string): boolean =>
  v.length >= PASSWORD_MIN_LENGTH && v.length <= 256 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v);
