import UIKit
import QuartzCore

// Intentionally standalone: isolates UIKit snapshot CPU cost, not map/RN FPS.
// Fixed frames avoid Yoga/layout-engine cost, so this is an optimistic workload.
final class MarkerContent: UIView {
  private let label = UILabel(frame: CGRect(x: 35, y: 8, width: 57, height: 30))

  init() {
    super.init(frame: CGRect(x: 0, y: 0, width: 96, height: 48))
    backgroundColor = .white
    layer.cornerRadius = 16
    let avatar = UIView(frame: CGRect(x: 6, y: 10, width: 28, height: 28))
    avatar.backgroundColor = .systemIndigo
    avatar.layer.cornerRadius = 14
    addSubview(avatar)
    label.font = .systemFont(ofSize: 14, weight: .semibold)
    label.textColor = .black
    addSubview(label)
    setValue(0)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unsupported") }

  func setValue(_ value: Int) {
    label.text = "$\(100 + value % 800)"
    label.setNeedsDisplay()
    layoutIfNeeded()
  }
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private let marker = MarkerContent()
  private var rows: [[String: Any]] = []
  private var jobs: [(String, Int)] = []
  private var checksum = 0
  private let sampleCount = 20
  private let warmupCount = 3
  private var cachedImages: [UIImage] = []
  private var cachedTargets: [UIImageView] = []
  private var renderer: UIGraphicsImageRenderer!

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    runNativeHostChecks()
    if ProcessInfo.processInfo.arguments.contains("--host-checks-only") {
      let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("results.json")
      try! Data("{\"nativeHostChecksPassed\":true}".utf8).write(to: output, options: .atomic)
    }
    let controller = UIViewController()
    controller.view.backgroundColor = .systemGray5
    marker.frame.origin = CGPoint(x: 30, y: 100)
    controller.view.addSubview(marker)
    let window = UIWindow(frame: UIScreen.main.bounds)
    window.rootViewController = controller
    self.window = window
    window.makeKeyAndVisible()
    let format = UIGraphicsImageRendererFormat()
    format.scale = 3
    format.preferredRange = .standard
    renderer = UIGraphicsImageRenderer(size: marker.bounds.size, format: format)
    if !ProcessInfo.processInfo.arguments.contains("--host-checks-only") {
      DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.prepare() }
    }
    return true
  }

  private func snapshot(_ mode: String) -> UIImage {
    renderer.image { context in
      if mode == "hierarchy" {
        precondition(marker.drawHierarchy(in: marker.bounds, afterScreenUpdates: true))
      } else {
        marker.layer.render(in: context.cgContext)
      }
    }
  }

  private func prepare() {
    // All source images exist before timings; no network or disk in this case.
    for i in 0..<200 {
      marker.setValue(i)
      cachedImages.append(snapshot("layer"))
      cachedTargets.append(UIImageView())
    }
    for count in [1, 10, 50, 200] {
      for mode in ["cached-image-assignment", "layer", "hierarchy", "layer-png-decode"] {
        jobs.append((mode, count))
      }
    }
    if ProcessInfo.processInfo.arguments.contains("--reverse") { jobs.reverse() }
    runNext()
  }

  private func runBatch(mode: String, count: Int, sample: Int) -> Double {
    let start = CACurrentMediaTime()
    autoreleasepool {
      for i in 0..<count {
        if mode == "cached-image-assignment" {
          // Rotate actual cached images, avoiding same-reference setter no-ops.
          let image = cachedImages[(i + sample) % cachedImages.count]
          cachedTargets[i].image = image
          checksum &+= image.cgImage!.width
        } else {
          marker.setValue(i + sample * count)
          let image = snapshot(mode)
          if mode == "layer-png-decode" {
            let data = image.pngData()!
            let decoded = UIImage(data: data)!
            // Force decoded pixels; UIImage(data:) alone can defer decoding.
            let prepared = decoded.preparingForDisplay()!
            checksum &+= prepared.cgImage!.width
          } else {
            checksum &+= image.cgImage!.width
          }
        }
      }
    }
    return (CACurrentMediaTime() - start) * 1000
  }

  private func runNext() {
    guard !jobs.isEmpty else { finish(); return }
    let (mode, count) = jobs.removeFirst()
    var samples: [Double] = []
    func nextSample(_ sample: Int) {
      let elapsed = self.runBatch(mode: mode, count: count, sample: sample)
      if sample >= self.warmupCount { samples.append(elapsed) }
      if sample + 1 < self.warmupCount + self.sampleCount {
        // Allow the run loop to service UIKit work between measured batches.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) { nextSample(sample + 1) }
      } else {
        let sorted = samples.sorted()
        let median = (sorted[9] + sorted[10]) / 2
        let row: [String: Any] = [
          "mode": mode, "markersPerBatch": count,
          "medianMs": median, "p95Ms": sorted[18], "maxMs": sorted.last!,
          "medianFractionOf8_33ms": median / (1000.0 / 120),
          "samplesMs": samples,
        ]
        self.rows.append(row)
        print("BENCH \(mode) n=\(count) median=\(median) ms")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self.runNext() }
      }
    }
    nextSample(0)
  }

  private func finish() {
    let image = cachedImages[0].cgImage!
    let result: [String: Any] = [
      "kind": "UIKit CPU microbenchmark; NOT map FPS or React Native benchmark",
      "timestamp": ISO8601DateFormatter().string(from: Date()),
      "os": UIDevice.current.systemVersion,
      "simulatorModel": ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? "unknown",
      "reportedMaximumFramesPerSecond": window!.screen.maximumFramesPerSecond,
      "sizePoints": [96, 48], "scale": 3,
      "pixelSize": [image.width, image.height],
      "bytesPerRaster": image.bytesPerRow * image.height,
      "sampleCount": sampleCount, "warmupCount": warmupCount,
      "reversedJobOrder": ProcessInfo.processInfo.arguments.contains("--reverse"),
      "nativeHostChecksPassed": true,
      "checksum": checksum, "results": rows,
    ]
    let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("results.json")
    do {
      try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
        .write(to: url, options: .atomic)
      print("BENCH_DONE")
    } catch { fatalError("Unable to save benchmark: \(error)") }
  }
}
