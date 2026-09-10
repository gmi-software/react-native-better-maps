import { POLAND_CENTER, POLAND_REGION } from '../fixtures/regions';
import { markers, moveMarkerFraction } from '../fixtures';
import { countLabel, pan, zoomSweep } from './helpers';
import type { Scenario, ScenarioContext, ScenarioTag } from './types';

function clusterScenario(count: number, tags: ScenarioTag[]): Scenario {
  const label = countLabel(count);
  return {
    id: `cluster-${label}`,
    name: `Clustering, ${label} markers`,
    group: 'clustering',
    description: `${count} clusterable markers at country scale: zoom sweep across octaves, a wide pan, then a 1 % marker update. Native spans separate cluster compute from apply.`,
    tags,
    props: () => ({
      region: POLAND_REGION,
      markers: markers(count, { clusterable: true }),
      clusteringEnabled: true,
    }),
    settleMs: count >= 50_000 ? 4000 : 2500,
    estimatedDurationMs: 16_000,
    async run(context: ScenarioContext) {
      await context.step('zoom-sweep', () =>
        zoomSweep(context, POLAND_CENTER, [7, 9, 12, 8, 5], 900),
      );
      await context.step('pan', () =>
        pan(context, POLAND_CENTER, { legs: 4, stepDegrees: 0.4, zoom: 6 }),
      );
      await context.step(
        'update-1pct',
        async () => {
          await context.setProps(
            {
              markers: moveMarkerFraction(
                markers(count, { clusterable: true }),
                0.01,
                1,
              ),
            },
            'update-1pct',
          );
          await context.sleep(1200);
        },
        { changed: Math.round(count * 0.01), total: count },
      );
    },
  };
}

export const CLUSTERING_SCENARIOS: Scenario[] = [
  clusterScenario(1000, ['baseline', 'quick']),
  clusterScenario(10_000, ['baseline', 'quick']),
  clusterScenario(50_000, ['baseline']),
  clusterScenario(100_000, ['heavy']),
];
