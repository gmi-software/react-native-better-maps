import { formatValue } from './metrics.mjs';
import { markdownTable } from './util.mjs';

/** Top native spans by main-thread time, as "name total/p95 (count)". */
function topSpans(native, limit = 3, key = 'mainThreadMs') {
  if (!native?.available) {
    return 'N/A';
  }
  return Object.entries(native.byName ?? {})
    .filter(([, stat]) => stat[key] > 0)
    .sort((a, b) => b[1][key] - a[1][key])
    .slice(0, limit)
    .map(([name, stat]) => `${name} ${stat[key].toFixed(1)} ms/p95 ${stat.p95Ms.toFixed(2)} (${stat.count})`)
    .join('; ');
}

/** Per-scenario evidence table used for the bottleneck analysis. */
export function digestTable(results) {
  const headers = ['Scenario', 'Mount commit', 'Mount → ready', 'Load: native main', 'Top native (interaction)', 'Top background', 'Retained after cleanup', 'Events to JS', 'Bridge latency'];
  const rows = [...results.values()].map((result) => [
    result.scenario,
    formatValue('ms', result.load?.commitMs),
    formatValue('ms', result.load?.readyMs),
    topSpans(result.load?.native, 2),
    topSpans(result.native, 3),
    topSpans(result.native, 2, 'backgroundMs'),
    formatValue('mb', result.memory?.retainedAfterCleanupMB),
    Object.entries(result.transfer?.eventsToJs ?? {}).map(([name, count]) => `${name}:${count}`).join(' ') || '-',
    result.bridge?.commitToNativeMs ? `${result.bridge.commitToNativeMs.avgMs} ms avg / ${result.bridge.commitToNativeMs.maxMs} max` : 'N/A',
  ]);
  return markdownTable(headers, rows);
}

/** Transfer profile: what each scenario pushed across the bridge. */
export function transferTable(results) {
  const headers = ['Scenario', 'Updates', 'Markers sent', 'Coordinates sent', 'Est. bytes', 'Largest update'];
  const rows = [...results.values()]
    .filter((result) => Object.keys(result.transfer?.updates ?? {}).length > 0)
    .map((result) => {
      const payload = result.transfer.payload ?? {};
      const items = Object.values(payload).reduce((sum, entry) => sum + entry.items, 0);
      const coordinates = Object.values(payload).reduce((sum, entry) => sum + entry.coordinates, 0);
      const bytes = Object.values(payload).reduce((sum, entry) => sum + entry.estimatedBytes, 0);
      const largest = Object.entries(result.transfer.largestUpdate ?? {})
        .sort((a, b) => b[1].estimatedBytes - a[1].estimatedBytes)[0];
      return [
        result.scenario,
        Object.entries(result.transfer.updates).map(([key, count]) => `${key}:${count}`).join(' '),
        String(payload.markers?.items ?? payload.markerChildren?.items ?? 0),
        String(coordinates),
        formatValue('bytes', bytes),
        largest ? `${largest[0]} ${formatValue('bytes', largest[1].estimatedBytes)} (${largest[1].coordinates} coords)` : '-',
      ];
    });
  return markdownTable(headers, rows);
}
