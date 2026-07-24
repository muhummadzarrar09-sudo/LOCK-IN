'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the value after `delay` ms of stability. Use to debounce
 * search inputs so we don't fire a Supabase query on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
