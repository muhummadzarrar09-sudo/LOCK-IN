/** Tiny validation helpers. Returns null on valid, error string on invalid. */

export type Validator = (v: string) => string | null;

export const required: Validator = (v) => (v.trim().length === 0 ? 'This field is required' : null);

export const email: Validator = (v) => {
  if (v.trim().length === 0) return 'Email is required';
  // Reasonable but not RFC-perfect
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
  return null;
};

export const minLength = (n: number): Validator => (v) =>
  v.length < n ? `Must be at least ${n} characters` : null;

export const maxLength = (n: number): Validator => (v) =>
  v.length > n ? `Must be at most ${n} characters` : null;

export const matches = (other: string, label = 'value'): Validator => (v) =>
  v === other ? null : `Must match ${label}`;

export const username: Validator = (v) => {
  if (v.trim().length === 0) return 'Username is required';
  if (v.length < 3) return 'Username must be at least 3 characters';
  if (v.length > 24) return 'Username must be at most 24 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Username can only contain letters, numbers, and underscores';
  return null;
};

/** Compose validators; first failing one wins. */
export const compose =
  (...vs: Validator[]): Validator =>
  (v) => {
    for (const fn of vs) {
      const r = fn(v);
      if (r) return r;
    }
    return null;
  };

/** Validate an object of fields. Returns { [field]: error }. */
export function validateValues<T extends Record<string, string>>(
  values: T,
  rules: { [K in keyof T]?: Validator },
): { [K in keyof T]?: string } {
  const errors: { [K in keyof T]?: string } = {};
  for (const k of Object.keys(rules) as Array<keyof T>) {
    const rule = rules[k];
    if (!rule) continue;
    const err = rule(values[k] || '');
    if (err) errors[k] = err;
  }
  return errors;
}

export const hasErrors = (e: Record<string, string | undefined>): boolean =>
  Object.values(e).some(Boolean);
