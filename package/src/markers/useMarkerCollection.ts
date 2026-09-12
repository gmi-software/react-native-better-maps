import { useState } from 'react';
import { MarkerCollection } from './MarkerCollection';

/**
 * Creates a `MarkerCollection` once for the lifetime of the component.
 *
 * ```tsx
 * const markers = useMarkerCollection();
 * useEffect(() => { markers.set(vehicles); }, [markers, vehicles]);
 * return <MapView markerCollection={markers} />;
 * ```
 */
export function useMarkerCollection(): MarkerCollection {
  const [collection] = useState(() => new MarkerCollection());
  return collection;
}
