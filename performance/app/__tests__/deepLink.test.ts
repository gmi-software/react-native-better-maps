import { describe, expect, test } from 'bun:test';
import { parseRunUrl } from '../deepLink';

describe('parseRunUrl', () => {
  test('parses scenarios, run id, label and repeat', () => {
    expect(
      parseRunUrl(
        'nitromapsperf://run?scenarios=markers-10k,camera-fast-pan-10k&runId=abc&label=pr%2042&repeat=3',
      ),
    ).toEqual({
      scenarios: ['markers-10k', 'camera-fast-pan-10k'],
      suite: undefined,
      runId: 'abc',
      label: 'pr 42',
      provider: undefined,
      repeat: 3,
    });
  });

  test('parses a suite', () => {
    expect(parseRunUrl('nitromapsperf://run?suite=baseline')?.suite).toBe(
      'baseline',
    );
  });

  test('rejects unrelated urls', () => {
    expect(parseRunUrl('nitromapsperf://other?scenarios=a')).toBeNull();
    expect(parseRunUrl('nitromapsperf://run')).toBeNull();
    expect(parseRunUrl(null)).toBeNull();
  });
});
