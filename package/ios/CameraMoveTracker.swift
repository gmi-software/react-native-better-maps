import Foundation
import NitroModules

/// The Promise of one camera move, settled exactly once.
///
/// A move ends in more ways than it begins: its animation runs out, the map reports the
/// camera has come to rest, a gesture or a later command cuts it short, or the view goes
/// away first. Whichever signal arrives first wins, and the rest are ignored - resolving
/// a Nitro Promise twice traps.
final class CameraMoveCompletion {
  private let promise: Promise<Void>
  fileprivate var onSettled: ((CameraMoveCompletion) -> Void)?
  private var isSettled = false

  init(promise: Promise<Void>) {
    self.promise = promise
  }

  func settle() {
    guard !isSettled else {
      return
    }

    isSettled = true
    onSettled?(self)
    onSettled = nil
    promise.resolve()
  }
}

/// Holds the camera moves still under way, so the one callback that says the camera has
/// come to rest settles all of them, and none outlives the adapter.
///
/// Register a move only after handing it to the map. Both SDKs report the end of the move
/// it cuts short from inside that hand-over, and a move registered before it would be
/// settled by that report - before its own animation had even started.
///
/// Main thread only, like the map views it serves.
final class CameraMoveTracker {
  /// Grace period on top of the requested duration before a move is assumed over. The
  /// map is expected to report the end of every move, and an unsettled Promise would
  /// hang its `await` for the lifetime of the view if it ever did not.
  private static let watchdogSlack: TimeInterval = 2

  private var pending: [CameraMoveCompletion] = []
  private var watchdog: Timer?

  deinit {
    settleAll()
  }

  /// Tracks `promise` until the camera comes to rest.
  func track(_ promise: Promise<Void>, duration: TimeInterval) {
    track(CameraMoveCompletion(promise: promise), duration: duration)
  }

  /// Tracks `move` until the camera comes to rest, or until the move settles itself.
  func track(_ move: CameraMoveCompletion, duration: TimeInterval) {
    move.onSettled = { [weak self] settled in
      self?.remove(settled)
    }
    pending.append(move)
    scheduleWatchdog(after: duration + Self.watchdogSlack)
  }

  /// Settles every move still under way. The camera has come to rest, so each of them
  /// is over - finished, superseded, or cut short - or the view is going away.
  func settleAll() {
    guard !pending.isEmpty else {
      return
    }

    let moves = pending
    pending.removeAll()
    stopWatchdog()
    for move in moves {
      move.settle()
    }
  }

  private func remove(_ move: CameraMoveCompletion) {
    pending.removeAll { $0 === move }
    if pending.isEmpty {
      stopWatchdog()
    }
  }

  private func scheduleWatchdog(after interval: TimeInterval) {
    watchdog?.invalidate()
    let timer = Timer(timeInterval: interval, repeats: false) { [weak self] _ in
      self?.settleAll()
    }
    RunLoop.main.add(timer, forMode: .common)
    watchdog = timer
  }

  private func stopWatchdog() {
    watchdog?.invalidate()
    watchdog = nil
  }
}
