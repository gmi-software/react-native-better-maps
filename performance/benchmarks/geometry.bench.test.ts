import { describe, expect, test } from 'bun:test';
import { distanceBetween } from '../../package/src/utils/geo';
import { deepDiffer } from '../app/deepDiffer';
import {
  generatePolygonCoordinates,
  generatePolylineCoordinates,
  perturbPolyline,
} from '../fixtures';
import { SIZES, measure, report, type Measurement } from './lib/bench';

/**
 * Geometry on the JS side. The library performs no geometry processing in
 * JS (coordinates go to native as-is), so this documents the cost of what
 * an app does around it and the cost of the prop diff on large coordinate
 * arrays; the projection / path building happens in the map SDKs and is
 * measured on device by the `polyline-*` / `polygon-*` scenarios.
 */
describe('geometry micro-benchmarks', () => {
  test('coordinate arrays', () => {
    const polyline: Measurement[] = [];
    const polygon: Measurement[] = [];
    const diffPolyline: Measurement[] = [];
    const perturb: Measurement[] = [];
    const haversine: Measurement[] = [];
    const flatten: Measurement[] = [];
    const stringify: Measurement[] = [];

    for (const n of SIZES) {
      const route = generatePolylineCoordinates(n);
      const descriptor = {
        id: 'r',
        coordinates: route,
        strokeColor: '#007AFF',
        strokeWidth: 4,
      };
      const moved = perturbPolyline(descriptor, 1);
      const json = JSON.stringify(route);
      polyline.push(
        measure('generatePolylineCoordinates', n, () =>
          generatePolylineCoordinates(n, { seed: 3 }),
        ),
      );
      polygon.push(
        measure('generatePolygonCoordinates', n, () =>
          generatePolygonCoordinates(n, { seed: 3 }),
        ),
      );
      diffPolyline.push(
        measure('deepDiffer polyline (10% points changed)', n, () =>
          deepDiffer([descriptor], [moved]),
        ),
      );
      perturb.push(
        measure('perturbPolyline (app-side immutable update)', n, () =>
          perturbPolyline(descriptor, 2),
        ),
      );
      haversine.push(
        measure('distanceBetween along route', n, () => {
          let total = 0;
          for (let index = 1; index < route.length; index += 1) {
            total += distanceBetween(route[index - 1], route[index]);
          }
          return total;
        }),
      );
      flatten.push(
        measure(
          'copy to Float64Array (reference: packed representation)',
          n,
          () => {
            const flat = new Float64Array(route.length * 2);
            for (let index = 0; index < route.length; index += 1) {
              flat[index * 2] = route[index].latitude;
              flat[index * 2 + 1] = route[index].longitude;
            }
            return flat;
          },
        ),
      );
      stringify.push(
        measure('JSON.stringify', n, () => JSON.stringify(route), {
          iterations: 3,
          extra: {
            bytes: json.length,
            bytesPerPoint: Math.round(json.length / n),
          },
        }),
      );
      expect(deepDiffer([descriptor], [moved])).toBe(true);
    }

    report('geometry', {
      'polyline fixture generation': polyline,
      'polygon fixture generation': polygon,
      'Fabric deepDiffer, polyline with 10% points moved': diffPolyline,
      'app-side immutable polyline update': perturb,
      'haversine distance over route (utils/geo)': haversine,
      'flatten to Float64Array (reference point, not a proposal)': flatten,
      'JSON payload size': stringify,
    });
  });
});
