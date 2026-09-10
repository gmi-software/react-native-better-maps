import { WARSAW_CENTER, WARSAW_REGION } from '../fixtures/regions';
import { markers } from '../fixtures';
import { countLabel, pan } from './helpers';
import type { Scenario } from './types';

function markerScenario(count: number, tags: Scenario['tags']): Scenario {
  const label = countLabel(count);
  return {
    id: `markers-${label}`,
    name: `${label} markers`,
    group: 'markers',
    description: `Mount ${count} markers through the bulk prop, settle, then a short 3-leg pan.`,
    tags,
    props: () => ({ region: WARSAW_REGION, markers: markers(count) }),
    settleMs: count >= 50_000 ? 4000 : count >= 10_000 ? 2500 : 1500,
    estimatedDurationMs: 9000,
    run: (context) => pan(context, WARSAW_CENTER, { legs: 3 }),
  };
}

function childrenScenario(count: number, tags: Scenario['tags']): Scenario {
  const label = countLabel(count);
  return {
    id: `markers-children-${label}`,
    name: `${label} <Marker> children`,
    group: 'markers',
    description: `Mount ${count} markers as <Marker> children (collected from React children on every render), then a short pan.`,
    tags,
    props: () => ({ region: WARSAW_REGION, markerChildren: markers(count) }),
    settleMs: 2000,
    estimatedDurationMs: 9000,
    run: (context) => pan(context, WARSAW_CENTER, { legs: 3 }),
  };
}

export const MARKER_SCENARIOS: Scenario[] = [
  markerScenario(100, ['baseline', 'quick']),
  markerScenario(1000, ['baseline', 'quick']),
  markerScenario(10_000, ['baseline', 'quick']),
  markerScenario(50_000, ['baseline']),
  markerScenario(100_000, ['heavy']),
  childrenScenario(1000, ['baseline']),
  childrenScenario(10_000, ['heavy']),
  {
    id: 'markers-10k-rich',
    name: '10k markers with titles and visual props',
    group: 'markers',
    description:
      'Same as markers-10k but every descriptor carries title, subtitle, rotation, opacity, anchor and flat, to measure optional-field conversion cost.',
    tags: ['baseline'],
    props: () => ({
      region: WARSAW_REGION,
      markers: markers(10_000, { withTitles: true, rich: true }),
    }),
    settleMs: 2500,
    estimatedDurationMs: 9000,
    run: (context) => pan(context, WARSAW_CENTER, { legs: 3 }),
  },
];
