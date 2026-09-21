import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Camera } from '../types/camera';
import { resolveCameraProp } from './resolveCameraProp';

/**
 * Holds the last camera the native view accepted, so an unset or invalid one
 * never makes the prop transition back to `undefined`.
 *
 * The counterpart of `useValidRegion`, and memoized the same way: on camera
 * identity, so a stable object is checked - and warned about - once rather than
 * on every render, with the ref written after commit.
 */
export function useValidCamera(camera: Camera | undefined): Camera | undefined {
  const lastAccepted = useRef<Camera | undefined>(undefined);
  const accepted = useMemo(
    () => resolveCameraProp(camera, lastAccepted.current),
    [camera],
  );

  useLayoutEffect(() => {
    lastAccepted.current = accepted;
  }, [accepted]);

  return accepted;
}
