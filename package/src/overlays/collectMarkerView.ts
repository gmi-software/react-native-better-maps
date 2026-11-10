import type { ReactElement } from 'react';
import type { MarkerViewProps } from '../types/markerView';
import { isValidCoordinate, isValidPoint } from '../utils/validateGeometry';
import type { OverlayCollectorState } from './overlayCollect';
import { OverlayType, type OverlayComponentType } from './overlayType';
import { warnOverlay } from './warnOverlay';

export function isMarkerViewElement(
  element: unknown,
): element is ReactElement<MarkerViewProps> {
  const type = (element as ReactElement | null)?.type as
    OverlayComponentType | undefined;
  return type?.overlayType === OverlayType.MarkerView;
}

function isValidSize(value: number | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 0;
}

/** Why `props` cannot be drawn, or null when it can. */
export function markerViewPropsProblem(props: MarkerViewProps): string | null {
  if (!isValidCoordinate(props.coordinate)) {
    return 'invalid coordinate';
  }
  if (!isValidSize(props.width) || !isValidSize(props.height)) {
    return 'width and height must be finite and positive';
  }
  if (props.anchor != null && !isValidPoint(props.anchor)) {
    return 'anchor must be finite';
  }
  return null;
}

/**
 * Collects one `MarkerView` child. Native clustering and viewport filtering
 * place it like any marker, but the SDK draws nothing for it: `MapView` mounts
 * its JSX while the pipeline reports it on screen.
 */
export function collectMarkerView(
  child: ReactElement,
  id: string,
  state: OverlayCollectorState,
): void {
  const element = child as ReactElement<MarkerViewProps>;
  const props = element.props;
  const problem = markerViewPropsProblem(props);
  if (problem != null) {
    warnOverlay(`MarkerView "${id}" skipped: ${problem}`);
    return;
  }

  state.markerViews.push({
    id,
    element,
    descriptor: {
      id,
      coordinate: props.coordinate,
      clusterable: props.clusterable ?? undefined,
      liveView: true,
    },
  });
}
