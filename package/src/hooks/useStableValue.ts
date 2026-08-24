import { useRef } from 'react';

/**
 * Keeps the previously returned value when {@linkcode next} is structurally
 * equal to it, as judged by {@linkcode isEqual}.
 *
 * Nitro compares view props by reference identity, so a value rebuilt from
 * unchanged data would otherwise be converted across JSI and re-applied to the
 * native view on every render of the component holding the `MapView`. For an
 * overlay array that means walking it into a `std::vector`, bridging it into a
 * native array and reconciling it against the map - all far more expensive than
 * the comparison done here.
 */
export function useStableValue<Value>(
  next: Value,
  isEqual: (left: Value, right: Value) => boolean,
): Value {
  const previous = useRef(next);
  const stable = isEqual(previous.current, next) ? previous.current : next;

  previous.current = stable;

  return stable;
}
