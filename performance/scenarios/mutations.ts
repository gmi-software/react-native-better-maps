import type { MarkerDescriptor } from 'react-native-better-maps';
import { WARSAW_REGION } from '../fixtures/regions';
import {
  appendMarker,
  markers,
  moveFirstMarkers,
  moveMarkerFraction,
  removeLastMarker,
} from '../fixtures';
import type { Scenario, ScenarioContext } from './types';

interface MutationCase {
  label: string;
  changed: number;
  apply(current: MarkerDescriptor[], tick: number): MarkerDescriptor[];
}

const REPEATS = 5;

function mutationCases(total: number): MutationCase[] {
  return [
    {
      label: 'add-1',
      changed: 1,
      apply: (current, tick) => appendMarker(current, tick),
    },
    {
      label: 'remove-1',
      changed: 1,
      apply: (current) => removeLastMarker(current),
    },
    {
      label: 'update-1',
      changed: 1,
      apply: (current, tick) => moveFirstMarkers(current, 1, tick),
    },
    {
      label: 'update-10',
      changed: 10,
      apply: (current, tick) => moveFirstMarkers(current, 10, tick),
    },
    {
      label: 'update-100',
      changed: 100,
      apply: (current, tick) => moveFirstMarkers(current, 100, tick),
    },
    {
      label: 'update-1pct',
      changed: Math.round(total * 0.01),
      apply: (current, tick) => moveMarkerFraction(current, 0.01, tick),
    },
    {
      label: 'update-10pct',
      changed: Math.round(total * 0.1),
      apply: (current, tick) => moveMarkerFraction(current, 0.1, tick),
    },
    {
      label: 'update-100pct',
      changed: total,
      apply: (current, tick) => moveMarkerFraction(current, 1, tick),
    },
  ];
}

/**
 * The marker update benchmark: with `total` markers mounted, how expensive
 * is changing 1, 10, 100, 1 %, 10 % and 100 % of them? Each case repeats
 * `REPEATS` times as its own step, so the result carries the JS commit time,
 * the native setter and pipeline spans, and the JS allocation delta per
 * step; the CLI report fits the scaling exponent across cases.
 */
function mutationBenchmark(
  total: number,
  key: 'markers' | 'markerChildren',
): Scenario {
  const suffix = key === 'markerChildren' ? '-children' : '';
  return {
    id: `mutations-${total / 1000}k${suffix}`,
    name: `Marker update cost at ${total / 1000}k${key === 'markerChildren' ? ' (children)' : ''}`,
    group: 'mutations',
    description: `With ${total} markers mounted, apply add/remove/update of 1, 10, 100, 1 %, 10 % and 100 % of the markers, ${REPEATS} repeats each.`,
    tags: key === 'markers' ? ['baseline', 'quick'] : ['baseline'],
    props: () => ({ region: WARSAW_REGION, [key]: markers(total) }),
    settleMs: 2500,
    estimatedDurationMs: 8 * REPEATS * 700 + 3000,
    async run(context: ScenarioContext) {
      let current = markers(total);
      let tick = 0;
      for (const mutation of mutationCases(total)) {
        for (let repeat = 0; repeat < REPEATS; repeat += 1) {
          tick += 1;
          await context.step(
            mutation.label,
            async () => {
              current = mutation.apply(current, tick);
              await context.setProps({ [key]: current }, mutation.label);
              // Let the native pipeline (fingerprint, index rebuild, viewport
              // refresh) finish so its spans land inside this step.
              await context.sleep(450);
            },
            { changed: mutation.changed, total: current.length, repeat },
          );
        }
      }
    },
  };
}

function continuousUpdates(
  total: number,
  moving: number,
  ticks: number,
  hz: number,
): Scenario {
  return {
    id: `mutations-continuous-${total / 1000}k`,
    name: `Continuous updates: ${moving} of ${total / 1000}k markers at ${hz} Hz`,
    group: 'mutations',
    description: `${moving} markers move every ${1000 / hz} ms for ${ticks / hz} s through prop updates while the camera is still.`,
    tags: ['baseline', 'quick'],
    props: () => ({ region: WARSAW_REGION, markers: markers(total) }),
    settleMs: 2000,
    estimatedDurationMs: (ticks * 1000) / hz + 2500,
    async run(context: ScenarioContext) {
      let current = markers(total);
      const interval = 1000 / hz;
      await context.step('continuous', async () => {
        for (let tick = 1; tick <= ticks; tick += 1) {
          const started = performance.now();
          current = moveFirstMarkers(current, moving, tick);
          await context.setProps({ markers: current }, `tick-${tick}`);
          const elapsed = performance.now() - started;
          await context.sleep(Math.max(0, interval - elapsed));
        }
      });
    },
  };
}

export const MUTATION_SCENARIOS: Scenario[] = [
  mutationBenchmark(10_000, 'markers'),
  mutationBenchmark(1000, 'markerChildren'),
  continuousUpdates(1000, 100, 50, 10),
  continuousUpdates(10_000, 100, 50, 10),
];
