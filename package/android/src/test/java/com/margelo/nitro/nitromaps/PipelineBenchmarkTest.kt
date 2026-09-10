package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * Times the marker pipeline's pure functions at 1k…100k markers on the JVM.
 * Skipped unless `NITROMAPS_BENCH=1` is set, so the normal unit test run is
 * unaffected. Output: one `[bench] {json}` line per measurement
 * (see performance/benchmarks/native/README.md).
 */
class PipelineBenchmarkTest {
  @Before
  fun requireOptIn() {
    assumeTrue("set NITROMAPS_BENCH=1 to run the pipeline benchmark", System.getenv("NITROMAPS_BENCH") == "1")
  }

  @Test
  fun pipelineScaling() {
    for (n in listOf(1_000, 10_000, 50_000, 100_000)) {
      val markers = dataset(n)
      val cityBounds = LatLngBounds(LatLng(52.17, 20.92), LatLng(52.29, 21.10))
      val countryBounds = LatLngBounds(LatLng(49.0, 14.1), LatLng(54.8, 24.1))

      record("fingerprint", n) { markers.markersFingerprint() }
      val index = record("indexBuild", n) { MarkerSpatialIndex(markers) }
      val cityCandidates = record("candidates(city)", n) { index.candidates(cityBounds) }
      val countryCandidates = record("candidates(country)", n) { index.candidates(countryBounds) }
      record("viewportFilter(city)", n, cityCandidates.size) {
        MarkerViewportFilter.displaySubset(cityCandidates, cityBounds, 0.12)
      }
      val clusters = record("clusters(country)", n, countryCandidates.size) {
        MarkerClusterEngine.clusters(countryCandidates, countryBounds, 1080, 2200, 2.75f)
      }
      record("clusters(city)", n, cityCandidates.size) {
        MarkerClusterEngine.clusters(cityCandidates, cityBounds, 1080, 2200, 2.75f)
      }
      val displayed = HashMap<String, Long>()
      for (element in clusters) {
        displayed[element.diffKey] = element.renderVersion
      }
      record("diff(unchanged)", n, clusters.size) { computeMarkerRenderDiff(clusters, displayed) }
      record("diff(empty)", n, clusters.size) { computeMarkerRenderDiff(clusters, emptyMap()) }
      record("singles(all)", n) { markers.map { ClusterElement.Single(it) } }
    }
  }

  private fun <T> record(op: String, n: Int, items: Int = n, block: () -> T): T {
    val iterations = maxOf(3, minOf(30, 300_000 / n))
    var result: T = block()
    val samples = DoubleArray(iterations)
    for (index in 0 until iterations) {
      val started = System.nanoTime()
      result = block()
      samples[index] = (System.nanoTime() - started) / 1_000_000.0
    }
    samples.sort()
    val median = samples[samples.size / 2]
    println(
      "[bench] {\"platform\":\"jvm\",\"op\":\"$op\",\"n\":$n,\"items\":$items," +
        "\"medianMs\":${"%.3f".format(median)},\"minMs\":${"%.3f".format(samples[0])}," +
        "\"maxMs\":${"%.3f".format(samples[samples.size - 1])},\"iterations\":$iterations}",
    )
    return result
  }

  /** Seeded Gaussian blobs around Polish cities, roughly like the JS fixtures. */
  private fun dataset(n: Int): Array<MarkerDescriptor> {
    val random = Mulberry32(12345 xor n)
    val cities = listOf(
      Triple(52.2297, 21.0122, 1.8), Triple(50.0647, 19.945, 0.78), Triple(51.7592, 19.456, 0.68),
      Triple(51.1079, 17.0385, 0.64), Triple(52.4064, 16.9252, 0.54), Triple(54.352, 18.6466, 0.47),
      Triple(53.4285, 14.5528, 0.4), Triple(50.2649, 19.0238, 0.5),
    )
    val totalWeight = cities.sumOf { it.third }
    return Array(n) { index ->
      var pick = random.next() * totalWeight
      var city = cities[0]
      for (candidate in cities) {
        pick -= candidate.third
        if (pick <= 0) {
          city = candidate
          break
        }
      }
      val spread = 0.1 + city.third * 0.16
      val lat = (city.first + random.gaussian() * spread).coerceIn(49.0, 54.8)
      val lon = (city.second + random.gaussian() * spread * 1.4).coerceIn(14.1, 24.1)
      MarkerDescriptor(
        "m-$index", Coordinate(lat, lon), null, null, null, true,
        null, null, null, null, null, null, null,
      )
    }
  }

  private class Mulberry32(seed: Int) {
    private var state = seed

    fun next(): Double {
      state += 0x6d2b79f5.toInt()
      var t = state
      t = (t xor (t ushr 15)) * (1 or t)
      t = (t + ((t xor (t ushr 7)) * (61 or t))) xor t
      return ((t xor (t ushr 14)).toLong() and 0xffffffffL) / 4294967296.0
    }

    fun gaussian(): Double {
      val u = maxOf(next(), 1e-12)
      val v = next()
      return sqrt(-2 * ln(u)) * cos(2 * Math.PI * v)
    }
  }
}
