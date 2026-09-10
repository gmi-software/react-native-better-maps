/**
 * Pulls the specific numbers the scorecard document cites out of a baseline
 * run, so PERFORMANCE.md can be regenerated from the result files.
 */
function median(values) {
  const sorted = values.filter((value) => value != null).sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)];
}

function stepMedians(result, label, pick) {
  return median((result?.steps ?? []).filter((step) => step.label === label).map(pick));
}

function span(result, name) {
  return result?.native?.byName?.[name] ?? null;
}

export function evidence(results) {
  const get = (id) => results.get(id);
  const m10k = get('mutations-10k');
  const commit = (label) => stepMedians(m10k, label, (step) => (step.commits.count > 0 ? step.commits.avgMs : null));
  const bridge = (label) => stepMedians(m10k, label, (step) => step.bridge?.commitToNativeMs?.avgMs ?? null);
  const setter = (label) => stepMedians(m10k, label, (step) => step.bridge?.setterMs?.avgMs ?? null);
  const alloc = (label) => stepMedians(m10k, label, (step) => step.hermes?.allocatedBytes ?? null);
  const stepSpan = (label, name) => stepMedians(m10k, label, (step) => step.native?.byName?.[name]?.totalMs ?? null);
  return {
    mount: Object.fromEntries(
      ['markers-100', 'markers-1k', 'markers-10k', 'markers-50k', 'markers-children-1k', 'markers-10k-rich', 'cluster-50k', 'polyline-100k'].map((id) => [
        id,
        { commitMs: get(id)?.load?.commitMs ?? null, readyMs: get(id)?.load?.readyMs ?? null, fingerprintCalls: get(id)?.load?.native?.byName?.['markers.fingerprint']?.count ?? null, setCalls: get(id)?.load?.native?.byName?.['markers.set']?.count ?? null },
      ]),
    ),
    mutations10k: Object.fromEntries(
      ['add-1', 'update-1', 'update-100', 'update-10pct', 'update-100pct'].map((label) => [
        label,
        {
          commitMs: commit(label),
          commitToNativeMs: bridge(label),
          setterMs: setter(label),
          fingerprintMs: stepSpan(label, 'markers.fingerprint'),
          indexBuildMs: stepSpan(label, 'markers.indexBuild'),
          applyDiffMs: stepSpan(label, 'markers.applyDiff'),
          jsAllocBytes: alloc(label),
        },
      ]),
    ),
    continuous10k: { commitAvgMs: get('mutations-continuous-10k')?.js?.commits?.avgMs ?? null, commitMaxMs: get('mutations-continuous-10k')?.js?.commits?.maxMs ?? null, jsLagP95: get('mutations-continuous-10k')?.js?.lagMs?.p95 ?? null, jsAllocBytes: get('mutations-continuous-10k')?.allocations?.hermes?.allocatedBytes ?? null, nativeMainMs: get('mutations-continuous-10k')?.native?.mainThreadMs ?? null },
    cluster: Object.fromEntries(
      ['cluster-1k', 'cluster-10k', 'cluster-50k'].map((id) => [
        id,
        { clusterP95Ms: span(get(id), 'markers.cluster')?.p95Ms ?? null, clusterMaxMs: span(get(id), 'markers.cluster')?.maxMs ?? null, clusterTotalMs: span(get(id), 'markers.cluster')?.totalMs ?? null, refreshes: span(get(id), 'markers.cluster')?.count ?? null, applyDiffP95Ms: span(get(id), 'markers.applyDiff')?.p95Ms ?? null, applyDiffTotalMs: span(get(id), 'markers.applyDiff')?.totalMs ?? null, updateCommitMs: stepMedians(get(id), 'update-1pct', (step) => (step.commits.count > 0 ? step.commits.avgMs : null)), p99: get(id)?.frames?.frameTimeMs?.p99 ?? null, worst: get(id)?.frames?.frameTimeMs?.worst ?? null },
      ]),
    ),
    shapes: Object.fromEntries(
      ['polyline-10k', 'polyline-100k', 'polygon-10k', 'polylines-200x50', 'polygons-200x20'].map((id) => {
        const key = id.startsWith('polygon') ? 'polygons.set' : 'polylines.set';
        return [id, { setP95Ms: span(get(id), key)?.p95Ms ?? null, setMaxMs: span(get(id), key)?.maxMs ?? null, setCalls: span(get(id), key)?.count ?? null, commitAvgMs: get(id)?.js?.commits?.avgMs ?? null, bridgeMs: get(id)?.bridge?.commitToNativeMs?.avgMs ?? null, jsAllocBytes: get(id)?.allocations?.hermes?.allocatedBytes ?? null, p99: get(id)?.frames?.frameTimeMs?.p99 ?? null, jank: get(id)?.frames?.jankRatio ?? null }];
      }),
    ),
    camera: Object.fromEntries(
      ['camera-idle-10k', 'camera-fast-pan-10k', 'camera-continuous-pan-10k', 'camera-zoom-in-10k', 'camera-zoom-out-10k', 'camera-rapid-zoom-10k', 'camera-rotate-10k', 'camera-pitch-10k', 'camera-fast-pan-50k'].map((id) => [
        id,
        { fps: get(id)?.frames?.fps?.average ?? null, p95: get(id)?.frames?.frameTimeMs?.p95 ?? null, p99: get(id)?.frames?.frameTimeMs?.p99 ?? null, worst: get(id)?.frames?.frameTimeMs?.worst ?? null, jank: get(id)?.frames?.jankRatio ?? null, nativeMainMs: get(id)?.native?.mainThreadMs ?? null, applyDiffTotalMs: span(get(id), 'markers.applyDiff')?.totalMs ?? null, applyDiffP95Ms: span(get(id), 'markers.applyDiff')?.p95Ms ?? null, viewForCalls: span(get(id), 'annotation.viewFor')?.count ?? null, visualPropsCalls: span(get(id), 'marker.visualProps')?.count ?? null, cameraApplyP95Ms: span(get(id), 'camera.apply')?.p95Ms ?? null, jsLagP95: get(id)?.js?.lagMs?.p95 ?? null, ramDeltaMB: get(id)?.memory?.interactionDeltaMB ?? null, eventsToJs: get(id)?.transfer?.eventsToJs ?? {} },
      ]),
    ),
    stability: (() => {
      const result = get('stability-5m');
      const windows = result?.timeline ?? [];
      return {
        windows: windows.map((window) => ({ label: window.label, fps: window.frames?.fps?.average, p99: window.frames?.frameTimeMs?.p99, ramMB: window.memory?.footprintMB, cpu: window.cpuPercent, jsAllocBytes: window.hermes?.allocatedBytes, nativeMainMs: window.native?.mainThreadMs })),
        retainedAfterCleanupMB: result?.memory?.retainedAfterCleanupMB ?? null,
        peakMB: result?.memory?.peakMB ?? null,
        nativeMainMs: result?.native?.mainThreadMs ?? null,
        applyDiffCalls: span(result, 'markers.applyDiff')?.count ?? null,
        cycles: result?.metrics?.cycles ?? null,
      };
    })(),
    retained: Object.fromEntries([...results.values()].map((result) => [result.scenario, result.memory?.retainedAfterCleanupMB ?? null])),
  };
}
