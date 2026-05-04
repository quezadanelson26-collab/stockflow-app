import { useState, useEffect } from 'react';

// ─── Debounce Hook ──────────────────────────────────────
// Delays updating a value until the user stops changing it.
// Perfect for search inputs that trigger DB queries.
//
// Usage:
//   const [search, setSearch] = useState('');
//   const debouncedSearch = useDebounce(search, 300);
//   useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
