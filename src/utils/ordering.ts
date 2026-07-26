/**
 * Reordering helpers for the ordered exercise lists. Every function returns a
 * new array and leaves an out-of-range index alone, so callers can wire them
 * straight to buttons without guarding the ends of the list themselves.
 */

function swap<T>(items: T[], a: number, b: number): T[] {
  if (a < 0 || b < 0 || a >= items.length || b >= items.length) return items;
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function moveUp<T>(items: T[], index: number): T[] {
  return swap(items, index, index - 1);
}

export function moveDown<T>(items: T[], index: number): T[] {
  return swap(items, index, index + 1);
}

export function removeAt<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items;
  return items.filter((_, i) => i !== index);
}
