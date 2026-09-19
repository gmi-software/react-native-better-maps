import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  collectOverlayChild,
  type OverlayCollectorDependencies,
} from './collectOverlayChild';
import type { OverlayCollectorState } from './overlayCollect';
import { isFragmentElement, overlayElementName } from './overlayElement';
import { warnOverlay } from './warnOverlay';

function warnUnknownOverlayChild(
  child: ReactElement,
  warnedTypes: Set<string>,
): void {
  const name = overlayElementName(child);
  if (warnedTypes.has(name)) {
    return;
  }
  warnedTypes.add(name);
  warnOverlay(
    `MapView: ignoring child <${name}>. Only <Marker>, <Polyline>, <Polygon>, <Circle> and <Geojson> are collected, and they must be direct children (Fragments are unwrapped, other components are not rendered). Return the elements from an array, or use the bulk \`markers\` / \`polylines\` / \`polygons\` / \`circles\` props.`,
  );
}

/**
 * Walk `MapView` children and collect overlay descriptors.
 *
 * Nested arrays are flattened. Fragments are unwrapped recursively. Wrapper
 * components are never rendered — they warn once per type in `__DEV__`.
 */
export function collectOverlayChildren(
  children: ReactNode,
  state: OverlayCollectorState,
  dependencies: OverlayCollectorDependencies,
): void {
  const warnedTypes = new Set<string>();

  function walk(node: ReactNode): void {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) {
        return;
      }

      if (isFragmentElement(child)) {
        walk((child.props as { children?: ReactNode }).children);
        return;
      }

      if (collectOverlayChild(child, state, dependencies)) {
        return;
      }

      warnUnknownOverlayChild(child, warnedTypes);
    });
  }

  walk(children);
}
