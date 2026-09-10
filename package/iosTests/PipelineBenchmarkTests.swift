import MapKit
import XCTest

@testable import NitroMaps

/// Times the marker pipeline's pure functions at 1k…100k markers on the
/// simulator. Skipped unless `NITROMAPS_BENCH=1` is in the environment.
/// Output: one `[bench] {json}` line per measurement
/// (see performance/benchmarks/native/README.md).
final class PipelineBenchmarkTests: XCTestCase {
  override func setUpWithError() throws {
    try XCTSkipUnless(
      ProcessInfo.processInfo.environment["NITROMAPS_BENCH"] == "1",
      "set NITROMAPS_BENCH=1 to run the pipeline benchmark"
    )
  }

  func testPipelineScaling() {
    let cityRegion = MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: 52.23, longitude: 21.01),
      span: MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.18)
    )
    let countryRegion = MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: 51.9, longitude: 19.1),
      span: MKCoordinateSpan(latitudeDelta: 5.8, longitudeDelta: 10)
    )
    let viewSize = CGSize(width: 393, height: 800)

    for n in [1_000, 10_000, 50_000, 100_000] {
      let markers = dataset(n)
      _ = record("fingerprint", n: n) { markers.markersFingerprint() }
      let index = record("indexBuild", n: n) { MarkerSpatialIndex(markers: markers) }
      let cityCandidates = record("candidates(city)", n: n) { index.candidates(in: cityRegion) }
      let countryCandidates = record("candidates(country)", n: n) { index.candidates(in: countryRegion) }
      _ = record("viewportFilter(city)", n: n, items: cityCandidates.count) {
        MarkerViewportFilter.displaySubset(candidates: cityCandidates, region: cityRegion)
      }
      let clusters = record("clusters(country)", n: n, items: countryCandidates.count) {
        MarkerClusterEngine.clusters(candidates: countryCandidates, region: countryRegion, viewSize: viewSize)
      }
      _ = record("clusters(city)", n: n, items: cityCandidates.count) {
        MarkerClusterEngine.clusters(candidates: cityCandidates, region: cityRegion, viewSize: viewSize)
      }
      _ = record("renderVersion(all singles)", n: n) {
        markers.map { MarkerClusterEngine.Element.single($0).renderVersion }
      }
      _ = record("diffKey(all clusters)", n: n, items: clusters.count) {
        clusters.map { $0.diffKey }
      }
    }
  }

  private func record<T>(_ op: String, n: Int, items: Int? = nil, _ block: () -> T) -> T {
    let iterations = max(3, min(30, 300_000 / n))
    var result = block()
    var samples: [Double] = []
    for _ in 0..<iterations {
      let started = DispatchTime.now().uptimeNanoseconds
      result = block()
      samples.append(Double(DispatchTime.now().uptimeNanoseconds - started) / 1_000_000)
    }
    samples.sort()
    let median = samples[samples.count / 2]
    print(
      "[bench] {\"platform\":\"ios-sim\",\"op\":\"\(op)\",\"n\":\(n),\"items\":\(items ?? n)," +
        "\"medianMs\":\(String(format: "%.3f", median)),\"minMs\":\(String(format: "%.3f", samples[0]))," +
        "\"maxMs\":\(String(format: "%.3f", samples[samples.count - 1])),\"iterations\":\(iterations)}"
    )
    return result
  }

  /// Seeded Gaussian blobs around Polish cities, roughly like the JS fixtures.
  private func dataset(_ n: Int) -> [MarkerDescriptor] {
    var random = Mulberry32(seed: UInt32(truncatingIfNeeded: 12345 ^ n))
    let cities: [(Double, Double, Double)] = [
      (52.2297, 21.0122, 1.8), (50.0647, 19.945, 0.78), (51.7592, 19.456, 0.68),
      (51.1079, 17.0385, 0.64), (52.4064, 16.9252, 0.54), (54.352, 18.6466, 0.47),
      (53.4285, 14.5528, 0.4), (50.2649, 19.0238, 0.5),
    ]
    let totalWeight = cities.reduce(0) { $0 + $1.2 }
    var markers: [MarkerDescriptor] = []
    markers.reserveCapacity(n)
    for index in 0..<n {
      var pick = random.next() * totalWeight
      var city = cities[0]
      for candidate in cities {
        pick -= candidate.2
        if pick <= 0 {
          city = candidate
          break
        }
      }
      let spread = 0.1 + city.2 * 0.16
      let lat = min(54.8, max(49.0, city.0 + random.gaussian() * spread))
      let lon = min(24.1, max(14.1, city.1 + random.gaussian() * spread * 1.4))
      markers.append(
        MarkerDescriptor(
          id: "m-\(index)",
          coordinate: Coordinate(latitude: lat, longitude: lon),
          title: nil,
          subtitle: nil,
          draggable: nil,
          clusterable: true,
          image: nil,
          anchor: nil,
          centerOffset: nil,
          rotation: nil,
          flat: nil,
          opacity: nil,
          enteringAnimation: nil
        )
      )
    }
    return markers
  }

  private struct Mulberry32 {
    var state: UInt32

    init(seed: UInt32) {
      state = seed
    }

    mutating func next() -> Double {
      state = state &+ 0x6d2b_79f5
      var t = state
      t = (t ^ (t >> 15)) &* (1 | t)
      t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
      return Double(t ^ (t >> 14)) / 4_294_967_296
    }

    mutating func gaussian() -> Double {
      let u = max(next(), 1e-12)
      let v = next()
      return (-2 * log(u)).squareRoot() * cos(2 * .pi * v)
    }
  }
}
