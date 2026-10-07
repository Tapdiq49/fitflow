import { isEmail, isStrongPassword, isValidUsername, normalizeUsername } from './auth-validation';

describe('auth validation', () => {
  it('accepts plain e-mail addresses only', () => {
    expect(isEmail('john@example.com')).toBe(true);
    expect(isEmail(' john@example.com ')).toBe(true);
    for (const bad of ['', 'john', 'john@', '@example.com', 'john@example', 'jo hn@example.com']) expect(isEmail(bad), bad).toBe(false);
  });

  it('accepts 3–30 lower-case letters, digits, "_" and "." (case is normalized, "@" is never allowed)', () => {
    expect(normalizeUsername('  John.Doe_1 ')).toBe('john.doe_1');
    for (const ok of ['john', 'John123', 'a_b.c', 'x'.repeat(30)]) expect(isValidUsername(ok), ok).toBe(true);
    for (const bad of ['jo', 'x'.repeat(31), 'john@example.com', 'john doe', 'john-doe', 'jöhn', '']) expect(isValidUsername(bad), bad).toBe(false);
  });

  it('wants 10+ characters with lower case, upper case and a digit', () => {
    expect(isStrongPassword('Abcdefghi1')).toBe(true);
    for (const bad of ['Abcdefgh1', 'abcdefghij1', 'ABCDEFGHIJ1', 'Abcdefghijk', '']) expect(isStrongPassword(bad), bad).toBe(false);
  });
});
