import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marker } from '../../package/src/components/Marker';
import type { OverlayComponentType } from '../../package/src/overlays/overlayType';
import { generateMarkers } from '../fixtures';
import { SIZES, measure, report, type Measurement } from './lib/bench';

// React lives in the library package's node_modules (bun isolated installs).
const requireFromPackage = createRequire(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'package',
    'package.json',
  ),
);
const React = requireFromPackage('react') as typeof import('react');

interface CollectedMarker {
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  subtitle?: string;
}

/**
 * Mirrors what `useCollectedOverlays` does on every `MapView` render when
 * markers are `<Marker>` children: walk `React.Children`, identify each
 * overlay component, and build a fresh descriptor array. It cannot call the
 * hook outside React, so the collector loop is replicated here; the in-app
 * `markers-children-*` scenarios measure the real thing end to end.
 */
function collect(children: React.ReactNode): CollectedMarker[] {
  const markers: CollectedMarker[] = [];
  let index = 0;
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }
    const type = child.type as OverlayComponentType;
    if (type.overlayType !== 'NitroMaps.Marker') {
      return;
    }
    const props = child.props as CollectedMarker;
    markers.push({
      id: props.id ?? `marker-${index}`,
      coordinate: props.coordinate,
      title: props.title,
      subtitle: props.subtitle,
    });
    index += 1;
  });
  return markers;
}

describe('children collection micro-benchmarks', () => {
  test('<Marker> children', () => {
    const createElements: Measurement[] = [];
    const collectChildren: Measurement[] = [];
    const total: Measurement[] = [];

    for (const n of SIZES) {
      const markers = generateMarkers(n);
      const build = () =>
        markers.map((marker) =>
          React.createElement(Marker, {
            key: marker.id,
            id: marker.id,
            coordinate: marker.coordinate,
          }),
        );
      const elements = build();
      createElements.push(measure('createElement × n', n, build));
      collectChildren.push(
        measure('Children.forEach collect', n, () => collect(elements)),
      );
      total.push(measure('elements + collect', n, () => collect(build())));
      expect(collect(elements)).toHaveLength(n);
    }

    report('collection', {
      'React.createElement for n <Marker> children (per parent render)':
        createElements,
      'collect descriptors from children (per MapView render)': collectChildren,
      'both (what one re-render of a children-based map costs before Nitro)':
        total,
    });
  });
});
