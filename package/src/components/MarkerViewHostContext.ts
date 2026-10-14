import { createContext } from 'react';

/** True inside the native map view that `MapView` mounts live markers into. */
export const MarkerViewHostContext = createContext(false);
