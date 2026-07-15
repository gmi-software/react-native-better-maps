import type { Coordinate, Region } from 'react-native-better-maps';

export type HotelCategory = 'budget' | 'boutique' | 'luxury' | 'business';

export interface Hotel {
  id: string;
  name: string;
  price: number;
  category: HotelCategory;
  coordinate: Coordinate;
}

const CENTER = {
  latitude: 52.2297,
  longitude: 21.0122,
};

/** Twelve hotels around central Warsaw for the carousel + clustering demo. */
export const HOTELS: readonly Hotel[] = [
  {
    id: 'hotel-1',
    name: 'Old Town Loft',
    price: 89,
    category: 'budget',
    coordinate: { latitude: 52.2497, longitude: 21.0122 },
  },
  {
    id: 'hotel-2',
    name: 'Royal Castle Inn',
    price: 129,
    category: 'boutique',
    coordinate: { latitude: 52.2478, longitude: 21.0148 },
  },
  {
    id: 'hotel-3',
    name: 'Vistula View',
    price: 159,
    category: 'business',
    coordinate: { latitude: 52.2395, longitude: 21.0285 },
  },
  {
    id: 'hotel-4',
    name: 'Palace Suites',
    price: 249,
    category: 'luxury',
    coordinate: { latitude: 52.2319, longitude: 21.0067 },
  },
  {
    id: 'hotel-5',
    name: 'Metro Stay',
    price: 79,
    category: 'budget',
    coordinate: { latitude: 52.2254, longitude: 21.0032 },
  },
  {
    id: 'hotel-6',
    name: 'Chopin Residence',
    price: 189,
    category: 'boutique',
    coordinate: { latitude: 52.2228, longitude: 21.0215 },
  },
  {
    id: 'hotel-7',
    name: 'Central Park Hotel',
    price: 119,
    category: 'business',
    coordinate: { latitude: 52.2186, longitude: 21.0128 },
  },
  {
    id: 'hotel-8',
    name: 'Presidential Plaza',
    price: 329,
    category: 'luxury',
    coordinate: { latitude: 52.2152, longitude: 21.0044 },
  },
  {
    id: 'hotel-9',
    name: 'Station Express',
    price: 69,
    category: 'budget',
    coordinate: { latitude: 52.2281, longitude: 20.9855 },
  },
  {
    id: 'hotel-10',
    name: 'Embassy Row',
    price: 219,
    category: 'business',
    coordinate: { latitude: 52.2335, longitude: 21.0352 },
  },
  {
    id: 'hotel-11',
    name: 'Garden Terrace',
    price: 149,
    category: 'boutique',
    coordinate: { latitude: 52.2412, longitude: 20.9988 },
  },
  {
    id: 'hotel-12',
    name: 'Skyline Grand',
    price: 279,
    category: 'luxury',
    coordinate: { latitude: 52.2268, longitude: 21.0425 },
  },
];

export const HOTEL_MAP_REGION: Region = {
  latitude: CENTER.latitude,
  longitude: CENTER.longitude,
  latitudeDelta: 0.055,
  longitudeDelta: 0.075,
};
