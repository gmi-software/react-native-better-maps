import { describe, expect, test } from 'bun:test';
import { assembleChunks } from '../../scripts/lib/logs.mjs';
import { base64 } from '../base64';

describe('result publishing fallback', () => {
  test('base64 matches Node for ASCII and UTF-8 text', () => {
    for (const text of [
      '',
      'a',
      'ab',
      'abc',
      '{"fps":58.1}',
      'Łazienki Park · 52.2°N',
      '😀 emoji',
    ]) {
      expect(base64(text)).toBe(Buffer.from(text, 'utf8').toString('base64'));
    }
  });

  test('chunked log lines reassemble to the original JSON', () => {
    const payload = {
      runId: 'r1',
      results: [
        { scenario: 'markers-10k', frames: { fps: { average: 58.1 } } },
      ],
    };
    const json = JSON.stringify(payload);
    const size = 7;
    const total = Math.ceil(json.length / size);
    const chunks = new Map();
    for (let index = 0; index < total; index += 1) {
      chunks.set(index, {
        index,
        total,
        data: base64(json.slice(index * size, (index + 1) * size)),
      });
    }
    expect(assembleChunks(chunks)).toEqual(payload);
    chunks.delete(3);
    expect(assembleChunks(chunks)).toBeNull();
  });
});
