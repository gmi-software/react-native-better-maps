import {
  POLAND_CENTER,
  POLAND_REGION,
  WARSAW_CENTER,
  WARSAW_REGION,
} from '../fixtures/regions';
import {
  generatePolygons,
  generatePolyline,
  markers,
  moveFirstMarkers,
  moveMarkerFraction,
  perturbPolyline,
} from '../fixtures';
import { pan, zoomSweep } from './helpers';
import type { Scenario } from './types';

export const COMBINED_SCENARIOS: Scenario[] = [
  {
    id: 'combined-10k-camera',
    name: '10k markers + camera',
    group: 'combined',
    description:
      'Six fast pan legs and a zoom sweep with 10k markers (no clustering).',
    tags: ['baseline', 'quick'],
    props: () => ({ region: WARSAW_REGION, markers: markers(10_000) }),
    settleMs: 2500,
    estimatedDurationMs: 12_000,
    async run(context) {
      await pan(context, WARSAW_CENTER, {
        legs: 6,
        legMs: 400,
        stepDegrees: 0.04,
      });
      await zoomSweep(context, WARSAW_CENTER, [10, 14, 12], 700);
    },
  },
  {
    id: 'combined-10k-cluster-camera',
    name: '10k markers + clustering + camera',
    group: 'combined',
    description:
      'Zoom sweep and pan with 10k clustered markers at country scale.',
    tags: ['baseline'],
    props: () => ({
      region: POLAND_REGION,
      markers: markers(10_000, { clusterable: true }),
      clusteringEnabled: true,
    }),
    settleMs: 2500,
    estimatedDurationMs: 12_000,
    async run(context) {
      await zoomSweep(context, POLAND_CENTER, [7, 10, 6], 800);
      await pan(context, POLAND_CENTER, {
        legs: 4,
        stepDegrees: 0.4,
        zoom: 6,
        legMs: 500,
      });
    },
  },
  {
    id: 'combined-10k-updates',
    name: '10k markers + updates',
    group: 'combined',
    description:
      '1 % of 10k markers move at 5 Hz for 5 s while the camera pans slowly.',
    tags: ['baseline'],
    props: () => ({ region: WARSAW_REGION, markers: markers(10_000) }),
    settleMs: 2500,
    estimatedDurationMs: 9000,
    async run(context) {
      let current = markers(10_000);
      const panning = pan(context, WARSAW_CENTER, {
        legs: 4,
        legMs: 1200,
        stepDegrees: 0.02,
      });
      await context.step('updates-while-panning', async () => {
        for (let tick = 1; tick <= 25; tick += 1) {
          current = moveMarkerFraction(current, 0.01, tick);
          await context.setProps({ markers: current }, `tick-${tick}`);
          await context.sleep(200);
        }
      });
      await panning;
    },
  },
  {
    id: 'combined-10k-polyline',
    name: '10k markers + 10k-point polyline',
    group: 'combined',
    description:
      'A 10k-point route over 10k markers: three route updates, then a pan.',
    tags: ['baseline'],
    props: () => ({
      region: WARSAW_REGION,
      markers: markers(10_000),
      polylines: [generatePolyline(10_000)],
    }),
    settleMs: 2500,
    estimatedDurationMs: 10_000,
    async run(context) {
      let route = generatePolyline(10_000);
      for (let tick = 0; tick < 3; tick += 1) {
        await context.step('route-update', async () => {
          route = perturbPolyline(route, tick);
          await context.setProps({ polylines: [route] }, 'route-update');
          await context.sleep(400);
        });
      }
      await pan(context, WARSAW_CENTER, { legs: 4, legMs: 500 });
    },
  },
  {
    id: 'combined-10k-polygon',
    name: '10k markers + 200 polygons',
    group: 'combined',
    description: '200 polygons over 10k markers: three restyles, then a pan.',
    tags: ['baseline'],
    props: () => ({
      region: WARSAW_REGION,
      markers: markers(10_000),
      polygons: generatePolygons(200, 20),
    }),
    settleMs: 2500,
    estimatedDurationMs: 10_000,
    async run(context) {
      const areas = generatePolygons(200, 20);
      const fills = ['#34C75944', '#FF950044', '#AF52DE44'];
      for (let tick = 0; tick < fills.length; tick += 1) {
        await context.step('restyle-all', async () => {
          await context.setProps(
            {
              polygons: areas.map((area) => ({
                ...area,
                fillColor: fills[tick],
              })),
            },
            'restyle-all',
          );
          await context.sleep(400);
        });
      }
      await pan(context, WARSAW_CENTER, { legs: 4, legMs: 500 });
    },
  },
  {
    id: 'combined-all',
    name: 'Markers + clustering + geometry + camera + updates',
    group: 'combined',
    description:
      '10k clustered markers, a 5k-point route and 100 polygons; zoom sweep, pan, and 100 moving markers at 5 Hz.',
    tags: ['baseline'],
    props: () => ({
      region: POLAND_REGION,
      markers: markers(10_000, { clusterable: true }),
      clusteringEnabled: true,
      polylines: [generatePolyline(5000)],
      polygons: generatePolygons(100, 20),
    }),
    settleMs: 3000,
    estimatedDurationMs: 16_000,
    async run(context) {
      let current = markers(10_000, { clusterable: true });
      await zoomSweep(context, POLAND_CENTER, [7, 11, 13], 800);
      const panning = pan(context, WARSAW_CENTER, {
        legs: 4,
        legMs: 900,
        stepDegrees: 0.02,
      });
      await context.step('updates-while-panning', async () => {
        for (let tick = 1; tick <= 20; tick += 1) {
          current = moveFirstMarkers(current, 100, tick);
          await context.setProps({ markers: current }, `tick-${tick}`);
          await context.sleep(200);
        }
      });
      await panning;
    },
  },
];
