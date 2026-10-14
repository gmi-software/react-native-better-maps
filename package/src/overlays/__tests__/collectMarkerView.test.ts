import { createElement, Fragment, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { Marker } from '../../components/Marker';
import type { MarkerViewProps } from '../../types/markerView';
import { collectOverlayChildren } from '../collectOverlayChild';
import {
  isMarkerViewElement,
  markerViewPropsProblem,
} from '../collectMarkerView';
import { OverlayType, type OverlayComponentType } from '../overlayType';

// Stands in for MarkerView, whose native host cannot load under bun. It is
// matched the same way: by `overlayType`, as a copy from another module path is.
function LiveMarker(_props: MarkerViewProps) {
  return null;
}
(LiveMarker as OverlayComponentType).overlayType = OverlayType.MarkerView;

const warnSpy = spyOn(console, 'warn');
const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;

beforeEach(() => {
  warnSpy.mockClear();
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

afterEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = previousDev;
});

const WARSAW = { latitude: 52.2297, longitude: 21.0122 };

function live(
  key: string | null,
  props: Partial<MarkerViewProps> = {},
): ReactNode {
  return createElement(LiveMarker, {
    key: key ?? undefined,
    coordinate: WARSAW,
    width: 96,
    height: 48,
    ...props,
  });
}

function collect(children: ReactNode) {
  return collectOverlayChildren(children, {
    resolveMarkerImage: () => undefined,
  });
}

describe('collecting MarkerView children', () => {
  test('a live marker is placed by the native pipeline but drawn by no SDK marker', () => {
    const state = collect([live('price', { clusterable: false })]);

    expect(state.markers).toEqual([]);
    expect(state.markerViews).toHaveLength(1);
    expect(state.markerViews[0].id).toBe('price');
    expect(state.markerViews[0].descriptor).toEqual({
      id: 'price',
      coordinate: WARSAW,
      clusterable: false,
      liveView: true,
    });
  });

  test('keeps its element, so MapView mounts the JSX the app rendered', () => {
    const element = live('price');
    const state = collect([element]);

    expect(state.markerViews[0].element).toBe(element as never);
  });

  test('shares one set of ids with Marker, as both feed one native list', () => {
    const state = collect([
      createElement(Marker, { key: 'a', coordinate: WARSAW }),
      live('a'),
    ]);

    expect(state.markers.map((marker) => marker.id)).toEqual(['a']);
    expect(state.markerViews.map((view) => view.id)).toEqual(['a#2']);
  });

  test('an id prop wins over the key', () => {
    const state = collect([live('row-1', { id: 'place-42' })]);

    expect(state.markerViews[0].id).toBe('place-42');
  });

  test('skips what cannot be drawn with a warning instead of crashing the map', () => {
    const state = collect([
      live('nan', { coordinate: { latitude: Number.NaN, longitude: 0 } }),
      live('zero', { width: 0 }),
      live('anchor', { anchor: { x: Number.POSITIVE_INFINITY, y: 1 } }),
      live('ok'),
    ]);

    expect(state.markerViews.map((view) => view.id)).toEqual(['ok']);
    const messages = warnSpy.mock.calls.map((call) => String(call[0]));
    expect(
      messages.some((message) =>
        message.includes('"nan" skipped: invalid coordinate'),
      ),
    ).toBe(true);
    expect(
      messages.some((message) =>
        message.includes('"zero" skipped: width and height'),
      ),
    ).toBe(true);
    expect(
      messages.some((message) => message.includes('"anchor" skipped: anchor')),
    ).toBe(true);
  });

  test('like every other overlay, only direct children are collected', () => {
    const state = collect([
      createElement(Fragment, { key: 'group' }, live('nested')),
    ]);

    expect(state.markerViews).toEqual([]);
  });
});

describe('isMarkerViewElement', () => {
  test('recognizes a MarkerView by its overlay type', () => {
    expect(isMarkerViewElement(live('a'))).toBe(true);
    expect(
      isMarkerViewElement(createElement(Marker, { coordinate: WARSAW })),
    ).toBe(false);
    expect(isMarkerViewElement(null)).toBe(false);
    expect(isMarkerViewElement('text')).toBe(false);
  });
});

describe('markerViewPropsProblem', () => {
  test('accepts anchors outside 0...1, which offset the marker on purpose', () => {
    expect(
      markerViewPropsProblem({
        coordinate: WARSAW,
        width: 10,
        height: 10,
        anchor: { x: -0.5, y: 2 },
      }),
    ).toBeNull();
  });
});
