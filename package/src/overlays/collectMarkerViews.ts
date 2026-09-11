import { Children, Fragment, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { MarkerView } from '../components/MarkerView';

/** Keep live hosts out of descriptor serialization, preserving React keys. */
export function collectMarkerViews(children: ReactNode): ReactElement[] {
  const result: ReactElement[] = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      const fragment = child as ReactElement<{ children?: ReactNode }>;
      const nested = collectMarkerViews(fragment.props.children);
      if (nested.length > 0)
        result.push(cloneElement(fragment, { children: nested }));
    } else if (child.type === MarkerView) {
      result.push(child);
    }
  });
  return result;
}
