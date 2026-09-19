import { Fragment } from 'react';
import type { ReactElement } from 'react';
import type { OverlayTypeName } from './overlayType';

const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');

interface WrappedComponentType {
  $$typeof?: symbol;
  displayName?: string;
  name?: string;
  overlayType?: OverlayTypeName;
  render?: unknown;
  type?: unknown;
}

export function isFragmentElement(element: ReactElement): boolean {
  return element.type === Fragment;
}

/**
 * Unwrap `React.memo` / `forwardRef` so overlay identity and `overlayType`
 * survive those wrappers.
 */
export function unwrapElementType(type: unknown): unknown {
  let current = type;

  for (let depth = 0; depth < 4; depth += 1) {
    if (
      current == null ||
      (typeof current !== 'object' && typeof current !== 'function')
    ) {
      return current;
    }

    const wrapped = current as WrappedComponentType;
    if (wrapped.$$typeof === REACT_MEMO_TYPE && wrapped.type != null) {
      current = wrapped.type;
      continue;
    }
    if (wrapped.$$typeof === REACT_FORWARD_REF_TYPE && wrapped.render != null) {
      current = wrapped.render;
      continue;
    }

    return current;
  }

  return current;
}

export function overlayElementName(element: ReactElement): string {
  const type = element.type;
  if (typeof type === 'string') {
    return type;
  }

  const named = namedComponent(type);
  if (named != null) {
    return named;
  }

  return namedComponent(unwrapElementType(type)) ?? 'Unknown';
}

function namedComponent(type: unknown): string | undefined {
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    if (fn.displayName != null && fn.displayName.length > 0) {
      return fn.displayName;
    }
    if (fn.name != null && fn.name.length > 0) {
      return fn.name;
    }
    return undefined;
  }

  if (typeof type === 'object' && type != null) {
    const obj = type as { displayName?: string; name?: string };
    if (obj.displayName != null && obj.displayName.length > 0) {
      return obj.displayName;
    }
    if (obj.name != null && obj.name.length > 0) {
      return obj.name;
    }
  }

  return undefined;
}
