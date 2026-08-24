import { useMemo } from 'react';
import { callback } from 'react-native-nitro-modules';

/**
 * Wraps {@linkcode handler} in Nitro's `{ f }` callback envelope, reusing the
 * same envelope for as long as the handler itself is stable.
 *
 * `callback(...)` allocates a new object on every call and Nitro diffs view
 * props by reference identity, so wrapping inline in JSX marks every event prop
 * dirty on each render - re-converting the function across JSI and re-applying
 * it to the native view. Passing `undefined` through is intentional: `callback`
 * returns it unchanged, which is how an unset handler is expressed.
 */
export function useNitroCallback<Handler>(handler: Handler) {
  return useMemo(() => callback(handler), [handler]);
}
