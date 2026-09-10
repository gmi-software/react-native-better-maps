/**
 * The CLI starts runs with a URL such as
 * `nitromapsperf://run?scenarios=markers-10k,camera-fast-pan-10k&runId=abc&label=pr-42`
 * or `nitromapsperf://run?suite=baseline`.
 */
export interface RunRequest {
  scenarios: string[];
  suite?: string;
  runId?: string;
  label?: string;
  provider?: string;
  repeat: number;
}

export function parseRunUrl(url: string | null | undefined): RunRequest | null {
  if (url == null) {
    return null;
  }
  const match = /^[a-z0-9+.-]+:\/\/run\/?\??(.*)$/i.exec(url.trim());
  if (match == null) {
    return null;
  }
  const params = new Map<string, string>();
  for (const pair of match[1].split('&')) {
    if (pair.length === 0) {
      continue;
    }
    const [key, value = ''] = pair.split('=');
    params.set(
      decodeURIComponent(key),
      decodeURIComponent(value.replace(/\+/g, ' ')),
    );
  }
  const scenarios = (params.get('scenarios') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const suite = params.get('suite') || undefined;
  if (scenarios.length === 0 && suite == null) {
    return null;
  }
  const repeat = Number.parseInt(params.get('repeat') ?? '1', 10);
  return {
    scenarios,
    suite,
    runId: params.get('runId') || undefined,
    label: params.get('label') || undefined,
    provider: params.get('provider') || undefined,
    repeat: Number.isFinite(repeat) && repeat > 0 ? repeat : 1,
  };
}

export function makeRunId(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
