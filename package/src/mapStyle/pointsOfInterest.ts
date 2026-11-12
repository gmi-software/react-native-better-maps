import type {
  ApplePoiCategory,
  NativePoiFilter,
} from '../native/specs/MapView.nitro';
import type { PoiCategory, PointsOfInterest } from '../types/map';
import { createWarn } from '../utils/warn';

const warnPointsOfInterest = createWarn('pointsOfInterest');

type GooglePoiFeatureType =
  | 'poi.attraction'
  | 'poi.business'
  | 'poi.government'
  | 'poi.medical'
  | 'poi.park'
  | 'poi.place_of_worship'
  | 'poi.school'
  | 'poi.sports_complex';

interface GoogleStyleRule {
  featureType: string;
  stylers: { visibility: 'on' | 'off' }[];
}

/**
 * The Google Maps POI group each category falls into. Categories left out have
 * no group of their own: Google files airports and transit stops under
 * `transit`, and beaches, marinas, parking and the like under no POI type.
 */
const GOOGLE_POI_FEATURE_TYPES: Partial<
  Record<ApplePoiCategory, GooglePoiFeatureType>
> = {
  amusementPark: 'poi.attraction',
  aquarium: 'poi.attraction',
  castle: 'poi.attraction',
  fortress: 'poi.attraction',
  landmark: 'poi.attraction',
  museum: 'poi.attraction',
  nationalMonument: 'poi.attraction',
  planetarium: 'poi.attraction',
  zoo: 'poi.attraction',

  animalService: 'poi.business',
  atm: 'poi.business',
  automotiveRepair: 'poi.business',
  bakery: 'poi.business',
  bank: 'poi.business',
  beauty: 'poi.business',
  bowling: 'poi.business',
  brewery: 'poi.business',
  cafe: 'poi.business',
  carRental: 'poi.business',
  distillery: 'poi.business',
  evCharger: 'poi.business',
  fitnessCenter: 'poi.business',
  foodMarket: 'poi.business',
  gasStation: 'poi.business',
  hotel: 'poi.business',
  laundry: 'poi.business',
  movieTheater: 'poi.business',
  musicVenue: 'poi.business',
  nightlife: 'poi.business',
  restaurant: 'poi.business',
  spa: 'poi.business',
  store: 'poi.business',
  theater: 'poi.business',
  winery: 'poi.business',

  postOffice: 'poi.government',

  // Google files pharmacies, police and fire stations with hospitals.
  fireStation: 'poi.medical',
  hospital: 'poi.medical',
  pharmacy: 'poi.medical',
  police: 'poi.medical',

  nationalPark: 'poi.park',
  park: 'poi.park',
  playground: 'poi.park',

  religiousSite: 'poi.place_of_worship',

  school: 'poi.school',
  university: 'poi.school',

  baseball: 'poi.sports_complex',
  basketball: 'poi.sports_complex',
  golf: 'poi.sports_complex',
  soccer: 'poi.sports_complex',
  stadium: 'poi.sports_complex',
  tennis: 'poi.sports_complex',
  volleyball: 'poi.sports_complex',
};

type CategoryFilter = Exclude<PointsOfInterest, string>;

/** Reads the filter without copying it: the equality check runs on every render. */
function categoryFilter(filter: CategoryFilter): {
  mode: 'include' | 'exclude';
  categories: readonly PoiCategory[];
} {
  if ('include' in filter && filter.include != null) {
    return { mode: 'include', categories: filter.include };
  }
  return { mode: 'exclude', categories: filter.exclude ?? [] };
}

function googleFeatureTypes(
  categories: readonly ApplePoiCategory[],
): GooglePoiFeatureType[] {
  const featureTypes = new Set<GooglePoiFeatureType>();
  for (const category of categories) {
    const featureType = GOOGLE_POI_FEATURE_TYPES[category];
    if (featureType != null) {
      featureTypes.add(featureType);
    }
  }
  return [...featureTypes];
}

function visibilityRule(
  featureType: string,
  visibility: 'on' | 'off',
): GoogleStyleRule {
  return { featureType, stylers: [{ visibility }] };
}

/**
 * Google Maps style rules that show the points of interest asked for. Empty
 * when the map's default already does.
 */
export function googlePoiStyleRules(
  pointsOfInterest: PointsOfInterest | undefined,
): GoogleStyleRule[] {
  if (pointsOfInterest == null || pointsOfInterest === 'all') {
    return [];
  }
  if (pointsOfInterest === 'none') {
    return [visibilityRule('poi', 'off')];
  }
  const { mode, categories } = categoryFilter(pointsOfInterest);
  const featureTypes = googleFeatureTypes(categories);
  if (mode === 'include') {
    return [
      visibilityRule('poi', 'off'),
      ...featureTypes.map((featureType) => visibilityRule(featureType, 'on')),
    ];
  }
  return featureTypes.map((featureType) => visibilityRule(featureType, 'off'));
}

/**
 * The style JSON a Google map gets: the rules generated for `pointsOfInterest`
 * first, then the app's own `customMapStyle` rules, so those win where both
 * style the same feature. Without generated rules, `customMapStyle` is passed
 * through untouched.
 */
export function resolveGoogleMapStyle(
  pointsOfInterest: PointsOfInterest | undefined,
  customMapStyle: string | undefined,
  googleMapId: string | undefined,
): string | undefined {
  const generatedRules = googlePoiStyleRules(pointsOfInterest);
  if (generatedRules.length === 0) {
    return customMapStyle;
  }

  if (googleMapId != null) {
    warnPointsOfInterest(
      'Google Maps ignores map styles when googleMapId is set, so pointsOfInterest has no effect. ' +
        'Set the POI visibility in the cloud map style instead.',
    );
  }

  if (customMapStyle == null || customMapStyle.trim() === '') {
    return JSON.stringify(generatedRules);
  }

  let customRules: unknown;
  try {
    customRules = JSON.parse(customMapStyle);
  } catch {
    customRules = undefined;
  }
  if (!Array.isArray(customRules)) {
    warnPointsOfInterest(
      'customMapStyle is not a JSON array of style rules, so only the pointsOfInterest rules are applied.',
    );
    return JSON.stringify(generatedRules);
  }

  return JSON.stringify([...generatedRules, ...customRules]);
}

/** The `pointsOfInterest` prop in the shape MapKit's native side reads. */
export function toApplePoiFilter(
  pointsOfInterest: PointsOfInterest | undefined,
): NativePoiFilter | undefined {
  if (pointsOfInterest == null) {
    return undefined;
  }
  if (typeof pointsOfInterest === 'string') {
    return { mode: pointsOfInterest, categories: [] };
  }
  const { mode, categories } = categoryFilter(pointsOfInterest);
  return { mode, categories: [...categories] };
}

/** Whether two `pointsOfInterest` values ask for the same thing. */
export function pointsOfInterestEqual(
  left: PointsOfInterest | undefined,
  right: PointsOfInterest | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  const leftFilter = categoryFilter(left);
  const rightFilter = categoryFilter(right);
  return (
    leftFilter.mode === rightFilter.mode &&
    leftFilter.categories.length === rightFilter.categories.length &&
    leftFilter.categories.every(
      (category, index) => category === rightFilter.categories[index],
    )
  );
}
