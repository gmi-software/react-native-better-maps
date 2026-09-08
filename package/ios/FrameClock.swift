import QuartzCore

/// A `CADisplayLink` that runs only while its owner has work.
///
/// The link targets a proxy, so scheduling it does not keep the owner alive;
/// the owner stops it explicitly and it is invalidated on deinit either way.
final class FrameClock {
  struct Frame {
    let timestamp: CFTimeInterval
    /// Time since the previous callback, nil on the first frame after start.
    let interval: CFTimeInterval?
    /// The display's current frame interval.
    let expected: CFTimeInterval
  }

  private final class Proxy: NSObject {
    weak var clock: FrameClock?

    @objc func tick(_ link: CADisplayLink) {
      clock?.tick(link)
    }
  }

  private let onFrame: (Frame) -> Void
  private var link: CADisplayLink?
  private var lastTimestamp: CFTimeInterval = 0

  init(onFrame: @escaping (Frame) -> Void) {
    self.onFrame = onFrame
  }

  deinit {
    link?.invalidate()
  }

  var isRunning: Bool {
    link != nil
  }

  func start() {
    guard link == nil else {
      return
    }
    let proxy = Proxy()
    proxy.clock = self
    let link = CADisplayLink(target: proxy, selector: #selector(Proxy.tick(_:)))
    link.add(to: .main, forMode: .common)
    self.link = link
    lastTimestamp = 0
  }

  func stop() {
    link?.invalidate()
    link = nil
    lastTimestamp = 0
  }

  private func tick(_ link: CADisplayLink) {
    let interval: CFTimeInterval? = lastTimestamp > 0 ? link.timestamp - lastTimestamp : nil
    lastTimestamp = link.timestamp
    onFrame(Frame(timestamp: link.timestamp, interval: interval, expected: link.duration))
  }
}
