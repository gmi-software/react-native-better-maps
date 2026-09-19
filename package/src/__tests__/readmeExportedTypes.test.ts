import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function exportedTypeNames(indexSource: string): string[] {
  const match = indexSource.match(
    /export type \{([\s\S]*?)\} from '\.\/types';/,
  );
  if (match?.[1] === undefined) {
    throw new Error('Could not find the export type block in index.ts');
  }

  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function readmeTypeNames(readme: string): string[] {
  const typesSection = readme.split('### Types')[1]?.split('\n### ')[0];
  if (typesSection === undefined) {
    throw new Error('Could not find the ### Types table in README.md');
  }

  return [...typesSection.matchAll(/^\| `([A-Za-z][A-Za-z0-9]*)`/gm)].flatMap(
    (match) => (match[1] === undefined ? [] : [match[1]]),
  );
}

describe('README Types table', () => {
  const indexSource = readFileSync(resolve(here, '../index.ts'), 'utf8');
  const readme = readFileSync(resolve(here, '../../../README.md'), 'utf8');

  test('lists every exported type in index.ts order', () => {
    expect(readmeTypeNames(readme)).toEqual(exportedTypeNames(indexSource));
  });
});
