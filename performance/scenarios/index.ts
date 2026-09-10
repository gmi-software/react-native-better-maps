import { CAMERA_SCENARIOS } from './camera';
import { CLUSTERING_SCENARIOS } from './clustering';
import { COMBINED_SCENARIOS } from './combined';
import { GEOMETRY_SCENARIOS } from './geometry';
import { MARKER_SCENARIOS } from './markers';
import { MUTATION_SCENARIOS } from './mutations';
import { STABILITY_SCENARIOS } from './stability';
import type { Scenario, ScenarioGroup, ScenarioTag } from './types';

export type {
  CommitSample,
  PerfMapProps,
  Scenario,
  ScenarioContext,
  ScenarioGroup,
  ScenarioTag,
  StepMeta,
} from './types';

export const SCENARIOS: Scenario[] = [
  ...MARKER_SCENARIOS,
  ...CAMERA_SCENARIOS,
  ...MUTATION_SCENARIOS,
  ...GEOMETRY_SCENARIOS,
  ...CLUSTERING_SCENARIOS,
  ...COMBINED_SCENARIOS,
  ...STABILITY_SCENARIOS,
];

const byId = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function findScenario(id: string): Scenario | undefined {
  return byId.get(id);
}

/**
 * Resolves a selector list to scenarios: an exact id, a group name
 * (`markers`, `camera`, …), a `tag:` prefix (`tag:baseline`) or a glob-ish
 * prefix ending in `*` (`camera-fast-pan-*`).
 */
export function resolveScenarios(selectors: string[]): Scenario[] {
  const picked: Scenario[] = [];
  const seen = new Set<string>();
  const push = (scenario: Scenario) => {
    if (!seen.has(scenario.id)) {
      seen.add(scenario.id);
      picked.push(scenario);
    }
  };

  for (const raw of selectors) {
    const selector = raw.trim();
    if (selector.length === 0) {
      continue;
    }
    const exact = byId.get(selector);
    if (exact) {
      push(exact);
      continue;
    }
    if (selector.startsWith('tag:')) {
      const tag = selector.slice(4) as ScenarioTag;
      SCENARIOS.filter((scenario) => scenario.tags.includes(tag)).forEach(push);
      continue;
    }
    if (selector.endsWith('*')) {
      const prefix = selector.slice(0, -1);
      SCENARIOS.filter((scenario) => scenario.id.startsWith(prefix)).forEach(
        push,
      );
      continue;
    }
    const group = selector as ScenarioGroup;
    const inGroup = SCENARIOS.filter((scenario) => scenario.group === group);
    if (inGroup.length > 0) {
      inGroup.forEach(push);
      continue;
    }
    throw new Error(`Unknown scenario selector "${selector}"`);
  }

  return picked;
}

/** Pure-data view of the catalog for CLIs and docs (no runtime code). */
export function catalog() {
  return SCENARIOS.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    group: scenario.group,
    tags: scenario.tags,
    description: scenario.description,
    estimatedDurationMs: scenario.estimatedDurationMs,
  }));
}
