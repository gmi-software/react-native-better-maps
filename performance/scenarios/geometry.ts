import { WARSAW_CENTER, WARSAW_REGION } from '../fixtures/regions';
import {
  generatePolygon,
  generatePolygons,
  generatePolyline,
  generatePolylines,
  perturbPolyline,
  restylePolyline,
} from '../fixtures';
import { countLabel, pan } from './helpers';
import type { Scenario, ScenarioContext, ScenarioTag } from './types';

function polylineScenario(points: number, tags: ScenarioTag[]): Scenario {
  const label = countLabel(points);
  return {
    id: `polyline-${label}`,
    name: `Polyline, ${label} points`,
    group: 'geometry',
    description: `One ${points}-point polyline: mount, five style-only updates, three geometry updates, then a short pan.`,
    tags,
    props: () => ({
      region: WARSAW_REGION,
      polylines: [generatePolyline(points)],
    }),
    settleMs: 1500,
    estimatedDurationMs: 12_000,
    async run(context: ScenarioContext) {
      let route = generatePolyline(points);
      for (let tick = 0; tick < 5; tick += 1) {
        await context.step(
          'restyle',
          async () => {
            route = restylePolyline(route, tick);
            await context.setProps({ polylines: [route] }, 'restyle');
            await context.sleep(300);
          },
          { points, tick },
        );
      }
      for (let tick = 0; tick < 3; tick += 1) {
        await context.step(
          'perturb',
          async () => {
            route = perturbPolyline(route, tick);
            await context.setProps({ polylines: [route] }, 'perturb');
            await context.sleep(300);
          },
          { points, tick },
        );
      }
      await pan(context, WARSAW_CENTER, { legs: 3, legMs: 500 });
    },
  };
}

function polygonScenario(points: number, tags: ScenarioTag[]): Scenario {
  const label = countLabel(points);
  return {
    id: `polygon-${label}`,
    name: `Polygon, ${label} vertices`,
    group: 'geometry',
    description: `One ${points}-vertex polygon: mount, five fill/stroke updates, then a short pan.`,
    tags,
    props: () => ({
      region: WARSAW_REGION,
      polygons: [generatePolygon(points)],
    }),
    settleMs: 1500,
    estimatedDurationMs: 9000,
    async run(context: ScenarioContext) {
      const area = generatePolygon(points);
      const fills = [
        '#34C75944',
        '#FF950044',
        '#AF52DE44',
        '#FF2D5544',
        '#007AFF44',
      ];
      for (let tick = 0; tick < fills.length; tick += 1) {
        await context.step(
          'restyle',
          async () => {
            await context.setProps(
              {
                polygons: [
                  { ...area, fillColor: fills[tick], strokeWidth: 2 + tick },
                ],
              },
              'restyle',
            );
            await context.sleep(300);
          },
          { points, tick },
        );
      }
      await pan(context, WARSAW_CENTER, { legs: 3, legMs: 500 });
    },
  };
}

export const GEOMETRY_SCENARIOS: Scenario[] = [
  polylineScenario(100, ['baseline']),
  polylineScenario(1000, ['baseline', 'quick']),
  polylineScenario(10_000, ['baseline']),
  polylineScenario(100_000, ['baseline', 'heavy']),
  polygonScenario(100, ['baseline']),
  polygonScenario(1000, ['baseline', 'quick']),
  polygonScenario(10_000, ['baseline']),
  {
    id: 'polylines-200x50',
    name: '200 polylines of 50 points',
    group: 'geometry',
    description:
      'Many small polylines: mount, three whole-set restyles, then a pan.',
    tags: ['baseline'],
    props: () => ({
      region: WARSAW_REGION,
      polylines: generatePolylines(200, 50),
    }),
    settleMs: 1500,
    estimatedDurationMs: 9000,
    async run(context) {
      const routes = generatePolylines(200, 50);
      for (let tick = 0; tick < 3; tick += 1) {
        await context.step(
          'restyle-all',
          async () => {
            await context.setProps(
              {
                polylines: routes.map((route) => restylePolyline(route, tick)),
              },
              'restyle-all',
            );
            await context.sleep(300);
          },
          { polylines: routes.length, tick },
        );
      }
      await pan(context, WARSAW_CENTER, { legs: 3, legMs: 500 });
    },
  },
  {
    id: 'polygons-200x20',
    name: '200 polygons of 20 vertices',
    group: 'geometry',
    description:
      'Many small polygons: mount, three whole-set restyles, then a pan.',
    tags: ['baseline'],
    props: () => ({
      region: WARSAW_REGION,
      polygons: generatePolygons(200, 20),
    }),
    settleMs: 1500,
    estimatedDurationMs: 9000,
    async run(context) {
      const areas = generatePolygons(200, 20);
      const fills = ['#34C75944', '#FF950044', '#AF52DE44'];
      for (let tick = 0; tick < fills.length; tick += 1) {
        await context.step(
          'restyle-all',
          async () => {
            await context.setProps(
              {
                polygons: areas.map((area) => ({
                  ...area,
                  fillColor: fills[tick],
                })),
              },
              'restyle-all',
            );
            await context.sleep(300);
          },
          { polygons: areas.length, tick },
        );
      }
      await pan(context, WARSAW_CENTER, { legs: 3, legMs: 500 });
    },
  },
];
