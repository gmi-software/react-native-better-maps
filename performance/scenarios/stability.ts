import { WARSAW_CENTER, WARSAW_REGION } from '../fixtures/regions';
import { markers, moveMarkerFraction } from '../fixtures';
import { pan, zoomSweep } from './helpers';
import type { Scenario } from './types';

function stabilityScenario(minutes: number): Scenario {
  return {
    id: `stability-${minutes}m`,
    name: `Stability, ${minutes} minutes`,
    group: 'stability',
    description: `${minutes} minutes of pan legs, zoom sweeps and 1 % marker updates over 10k clustered markers, with a timeline checkpoint (frames, memory, CPU, GC) every minute. The question: does performance degrade over time?`,
    tags: minutes <= 5 ? ['long', 'baseline'] : ['long'],
    props: () => ({
      region: WARSAW_REGION,
      markers: markers(10_000, { clusterable: true }),
      clusteringEnabled: true,
    }),
    settleMs: 3000,
    estimatedDurationMs: minutes * 60_000 + 5000,
    async run(context) {
      let current = markers(10_000, { clusterable: true });
      const end = Date.now() + minutes * 60_000;
      let cycle = 0;
      let nextCheckpoint = Date.now() + 60_000;
      while (Date.now() < end) {
        cycle += 1;
        await pan(context, WARSAW_CENTER, {
          legs: 4,
          legMs: 500,
          stepDegrees: 0.03,
        });
        await zoomSweep(context, WARSAW_CENTER, [10, 13, 12], 600);
        current = moveMarkerFraction(current, 0.01, cycle);
        await context.setProps({ markers: current }, `update-${cycle}`);
        await context.sleep(300);
        if (Date.now() >= nextCheckpoint) {
          await context.checkpoint(
            `minute-${Math.round((Date.now() - (end - minutes * 60_000)) / 60_000)}`,
          );
          nextCheckpoint = Date.now() + 60_000;
        }
      }
      context.metric('cycles', cycle);
    },
  };
}

export const STABILITY_SCENARIOS: Scenario[] = [
  stabilityScenario(5),
  stabilityScenario(15),
];
