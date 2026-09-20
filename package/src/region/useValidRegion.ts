import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Region } from '../types/region';
import { resolveRegionProp } from './resolveRegionProp';

/**
 * Holds the last region the native view accepted, so an invalid one can be
 * dropped without the prop ever transitioning back to `undefined`.
 *
 * Memoized on region identity so a stable object is checked - and warned about
 * - once rather than on every render. The ref is written after commit, as in
 * `useStableValue`: a value remembered from a render React discarded is a value
 * the native view never received.
 */
export function useValidRegion(region: Region | undefined): Region | undefined {
  const lastAccepted = useRef<Region | undefined>(undefined);
  // Reading the ref here is safe: it only matters at the moment `region`
  // changes, which is exactly when this recomputes.
  const accepted = useMemo(
    () => resolveRegionProp(region, lastAccepted.current),
    [region],
  );

  useLayoutEffect(() => {
    lastAccepted.current = accepted;
  }, [accepted]);

  return accepted;
}
