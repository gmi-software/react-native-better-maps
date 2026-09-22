import { useLayoutEffect, useState } from 'react';
import { MapViewCommands } from '../native/mapViewCommands';
import type { MapView as NativeMapViewHybrid } from '../native/specs/MapView.nitro';

/**
 * Owns the imperative command channel for one native map view.
 *
 * The channel outlives a render but not the view it talks to: when
 * {@linkcode nativeViewKey} changes, the native view is remounted and the
 * handle the old channel holds becomes a dead object, so a fresh channel takes
 * over and calls made during the swap are buffered for the incoming view.
 */
export function useMapViewCommands(nativeViewKey: string) {
  const [commands, setCommands] = useState(
    () => new MapViewCommands<NativeMapViewHybrid>(),
  );
  const [commandsKey, setCommandsKey] = useState(nativeViewKey);

  if (commandsKey !== nativeViewKey) {
    setCommandsKey(nativeViewKey);
    setCommands(new MapViewCommands<NativeMapViewHybrid>());
  }

  // Layout phase, not passive: the cleanup has to close the channel while the
  // native view is still there. React removes the view before passive effects
  // run, and until the channel knows it is gone a retained handle would reach
  // the dead native object instead of being rejected here.
  //
  // It also rejects whatever the outgoing channel still held, because React
  // runs this cleanup for the old instance before arming the new one.
  useLayoutEffect(() => {
    commands.mount();
    return () => commands.unmount();
  }, [commands]);

  return commands;
}
