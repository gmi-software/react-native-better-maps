import { Children, Fragment, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  MarkerView,
  validateMarkerViewProps,
  type MarkerViewProps,
} from '../components/MarkerView';

export interface MarkerViewEntry {
  viewId: string;
  markerId: string;
  element: ReactElement<MarkerViewProps>;
}

/** Fragment paths distinguish repeated local keys while retaining host identity. */
export function collectMarkerViewEntries(
  children: ReactNode,
): MarkerViewEntry[] {
  const entries: MarkerViewEntry[] = [];
  function visit(nodes: ReactNode, parent: string[]) {
    Children.toArray(nodes).forEach((child) => {
      if (!isValidElement(child)) return;
      const segments = [...parent, String(child.key)];
      const path = JSON.stringify(segments);
      if (child.type === Fragment) {
        visit((child.props as { children?: ReactNode }).children, segments);
      } else if (child.type === MarkerView) {
        const element = child as ReactElement<MarkerViewProps>;
        validateMarkerViewProps(element.props);
        entries.push({
          viewId: path,
          markerId: element.props.id ?? `marker-view:${path}`,
          element: cloneElement(element, { key: path }),
        });
      }
    });
  }
  visit(children, []);
  return entries;
}
