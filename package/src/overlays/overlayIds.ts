import { warnOverlay } from './warnOverlay';

export type OverlayIdKind =
  'marker' | 'polyline' | 'polygon' | 'circle' | 'geojson';

export type OverlayIdCounts = Record<OverlayIdKind, number>;

const OVERLAY_NOUNS: Record<OverlayIdKind, [singular: string, plural: string]> =
  {
    marker: ['marker', 'markers'],
    polyline: ['polyline', 'polylines'],
    polygon: ['polygon', 'polygons'],
    circle: ['circle', 'circles'],
    geojson: ['Geojson layer', 'Geojson layers'],
  };

const OVERLAY_ID_KINDS = Object.keys(OVERLAY_NOUNS) as OverlayIdKind[];

/**
 * The ids handed out in one pass over a `MapView`'s children. An overlay's id
 * is its `id` prop, else its React `key`, else its position among the overlays
 * of its kind that have neither (`marker-0`, `marker-1`, ...). Native diffing
 * and the `MapView` press callbacks key on it, so it has to stay with its
 * overlay when a sibling is added or removed, which a position does not.
 */
export interface OverlayIdState {
  reserved: Record<OverlayIdKind, Set<string>>;
  taken: Record<OverlayIdKind, Set<string>>;
  /** Overlays seen so far with neither an `id` nor a `key`. */
  anonymous: OverlayIdCounts;
}

export function createOverlayIdState(): OverlayIdState {
  return {
    reserved: namespaces(),
    taken: namespaces(),
    anonymous: { marker: 0, polyline: 0, polygon: 0, circle: 0, geojson: 0 },
  };
}

function namespaces(): Record<OverlayIdKind, Set<string>> {
  return {
    marker: new Set(),
    polyline: new Set(),
    polygon: new Set(),
    circle: new Set(),
    geojson: new Set(),
  };
}

function isPresent(value: string | null | undefined): value is string {
  return value != null && value.length > 0;
}

function isInUse(
  ids: OverlayIdState,
  kind: OverlayIdKind,
  id: string,
): boolean {
  return ids.reserved[kind].has(id) || ids.taken[kind].has(id);
}

export function reserveOverlayId(
  ids: OverlayIdState,
  kind: OverlayIdKind,
  idProp: string | null | undefined,
): void {
  if (isPresent(idProp)) {
    ids.reserved[kind].add(idProp);
  }
}

/**
 * Hands out the id of the next overlay of `kind`, in children order.
 *
 * An `id` prop is used as given. A key or a position that another overlay of
 * the kind already has gets a `#2`, `#3`, ... suffix instead, because two
 * overlays with one id collapse into one on native: React keys only have to be
 * unique within one list, but a `MapView` flattens all of its lists.
 */
export function claimOverlayId(
  ids: OverlayIdState,
  kind: OverlayIdKind,
  idProp: string | null | undefined,
  key: string | null | undefined,
): string {
  const [singular, plural] = OVERLAY_NOUNS[kind];

  if (isPresent(idProp)) {
    if (ids.taken[kind].has(idProp)) {
      warnOverlay(
        `two ${plural} have the id "${idProp}", so only one of them is drawn. Give each ${singular} its own id.`,
      );
    }
    ids.taken[kind].add(idProp);
    return idProp;
  }

  let requested: string;
  if (isPresent(key)) {
    requested = key;
  } else {
    requested = `${kind}-${ids.anonymous[kind]}`;
    ids.anonymous[kind] += 1;
  }

  let id = requested;
  for (let copy = 2; isInUse(ids, kind, id); copy += 1) {
    id = `${requested}#${copy}`;
  }

  if (id !== requested) {
    warnOverlay(
      isPresent(key)
        ? `${singular} key "${key}" is already the id of another ${singular}, so this one gets the id "${id}". Keys only need to be unique within one list, but all ${plural} of a MapView share one set of ids: give them distinct keys or ids.`
        : `${singular} "${requested}" (no id or key) is already the id of another ${singular}, so this one gets the id "${id}".`,
    );
  }

  ids.taken[kind].add(id);
  return id;
}

export interface PositionalIdTracker {
  previous: OverlayIdCounts | null;
  warned: Set<OverlayIdKind>;
}

export function createPositionalIdTracker(): PositionalIdTracker {
  return { previous: null, warned: new Set() };
}

/**
 * Warns in development, once per kind, when the number of overlays identified
 * by position changes while some of them stay: adding or removing one moves
 * the ids of those after it. React stays silent about the missing keys - it
 * only checks lists it renders, and `MapView` never renders its children.
 */
export function trackPositionalIds(
  tracker: PositionalIdTracker,
  counts: OverlayIdCounts,
): void {
  const previous = tracker.previous;
  tracker.previous = { ...counts };
  if (previous == null) {
    return;
  }

  for (const kind of OVERLAY_ID_KINDS) {
    const before = previous[kind];
    const after = counts[kind];
    if (
      before === after ||
      Math.min(before, after) === 0 ||
      tracker.warned.has(kind)
    ) {
      continue;
    }

    tracker.warned.add(kind);
    const [, plural] = OVERLAY_NOUNS[kind];
    warnOverlay(
      `the number of ${plural} with neither an id nor a key went from ${before} to ${after}. MapView tells them apart by position, so adding or removing one gives the ${plural} after it new ids: they are redrawn, and entering animations play on the wrong one. Give each a key or an id.`,
    );
  }
}
