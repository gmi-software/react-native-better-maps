import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// iOS and Android each draw the cluster badge natively, from a style defined once
// per platform. This is what keeps the two definitions from drifting apart.

const packageRoot = join(__dirname, '../../..');

function readSource(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

function normalize(literal: string): string {
  return literal.startsWith('"')
    ? literal
    : String(Number(literal.replace(/f$/, '')));
}

/** `static let borderWidth: CGFloat = 2` becomes `borderWidth: '2'`. */
function swiftConstants(source: string): Record<string, string> {
  const constants: Record<string, string> = {};
  for (const [, name, literal] of source.matchAll(
    /^\s*static let (\w+)(?:: \w+)? = ("[^"]*"|[\d.]+)$/gm,
  )) {
    constants[name!] = normalize(literal!);
  }
  return constants;
}

/** `const val BORDER_WIDTH_DP = 2f` becomes `borderWidth: '2'`. */
function kotlinConstants(source: string): Record<string, string> {
  const constants: Record<string, string> = {};
  for (const [, name, literal] of source.matchAll(
    /^\s*const val (\w+) = ("[^"]*"|[\d.]+f?)$/gm,
  )) {
    const camelCaseName = name!
      .replace(/_DP$/, '')
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    constants[camelCaseName] = normalize(literal!);
  }
  return constants;
}

describe('cluster badge style', () => {
  test('defines the same badge on iOS and Android', () => {
    const ios = swiftConstants(
      readSource('ios/ClusterBadge/ClusterBadgeStyle.swift'),
    );
    const android = kotlinConstants(
      readSource(
        'android/src/main/java/com/margelo/nitro/nitromaps/ClusterBadgeStyle.kt',
      ),
    );

    // A pattern that stopped matching would otherwise compare two empty objects.
    expect(Object.keys(ios)).toContain('gradientTopColor');
    expect(Object.keys(ios)).toContain('shadowRadius');
    expect(android).toEqual(ios);
  });
});
