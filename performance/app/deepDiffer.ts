/**
 * A TypeScript port of React Native's `deepDiffer`
 * (Libraries/Utilities/differ/deepDiffer.js), the comparison Fabric runs on
 * every object/array prop of a host component whose `validAttributes` entry
 * is `true` (all Nitro view props). The lab times it on the same prop values
 * it commits, to attribute that share of the JS commit.
 */
export interface DeepDifferOptions {
  unsafelyIgnoreFunctions?: boolean;
}

const FABRIC_OPTIONS: DeepDifferOptions = { unsafelyIgnoreFunctions: true };

export function deepDiffer(
  one: unknown,
  two: unknown,
  maxDepth = -1,
  options: DeepDifferOptions = FABRIC_OPTIONS,
): boolean {
  if (maxDepth === 0) {
    return true;
  }
  if (one === two) {
    return false;
  }
  if (typeof one === 'function' && typeof two === 'function') {
    return options.unsafelyIgnoreFunctions !== true;
  }
  if (typeof one !== 'object' || one === null) {
    return one !== two;
  }
  if (typeof two !== 'object' || two === null) {
    return true;
  }
  if (one.constructor !== two.constructor) {
    return true;
  }
  if (Array.isArray(one)) {
    const length = one.length;
    if ((two as unknown[]).length !== length) {
      return true;
    }
    for (let index = 0; index < length; index += 1) {
      if (
        deepDiffer(one[index], (two as unknown[])[index], maxDepth - 1, options)
      ) {
        return true;
      }
    }
  } else {
    const left = one as Record<string, unknown>;
    const right = two as Record<string, unknown>;
    for (const key in left) {
      if (deepDiffer(left[key], right[key], maxDepth - 1, options)) {
        return true;
      }
    }
    for (const key in right) {
      if (left[key] === undefined && right[key] !== undefined) {
        return true;
      }
    }
  }
  return false;
}
