import GoogleMaps
import QuartzCore
import UIKit

enum ResolvedOverlayEnteringAnimationKind: Equatable {
  case none
  case system
  case fade
  case fadeScale
}

struct ResolvedOverlayEnteringAnimation: Equatable {
  let kind: ResolvedOverlayEnteringAnimationKind
  let duration: TimeInterval
  let delay: TimeInterval
  let reduceMotion: OverlayEnteringAnimationReduceMotion
}

enum OverlayEnteringAnimationResolver {
  static func resolve(
    _ animation: OverlayEnteringAnimationDescriptor?,
    fallback: OverlayEnteringAnimationDescriptor? = nil
  ) -> ResolvedOverlayEnteringAnimation {
    let descriptor = animation ?? fallback
    let kind: ResolvedOverlayEnteringAnimationKind
    switch descriptor?.kind {
    case .some(.none):
      kind = .none
    case .some(.fade):
      kind = .fade
    case .some(.fadeScale):
      kind = .fadeScale
    case .some(.system), nil:
      kind = .system
    }

    return ResolvedOverlayEnteringAnimation(
      kind: kind,
      duration: seconds(fromMilliseconds: descriptor?.duration, defaultMilliseconds: 180),
      delay: seconds(fromMilliseconds: descriptor?.delay, defaultMilliseconds: 0),
      reduceMotion: descriptor?.reduceMotion ?? .system
    )
  }

  static func shouldRun(_ animation: ResolvedOverlayEnteringAnimation) -> Bool {
    guard animation.kind != .none else {
      return false
    }
    guard animation.reduceMotion != .system || !UIAccessibility.isReduceMotionEnabled else {
      return false
    }
    return animation.duration > 0
  }

  static func animateAnnotationView(
    _ view: UIView,
    animation: ResolvedOverlayEnteringAnimation,
    supportsScale: Bool
  ) {
    guard shouldRun(animation) else {
      return
    }

    let shouldScale = animation.kind == .fadeScale && supportsScale
    view.alpha = 0
    if shouldScale {
      view.transform = CGAffineTransform(scaleX: 0.85, y: 0.85)
    }

    UIView.animate(
      withDuration: animation.duration,
      delay: animation.delay,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut]
    ) {
      view.alpha = 1
      if shouldScale {
        view.transform = .identity
      }
    }
  }

  static func prepareGoogleMarker(_ marker: GMSMarker, animation: ResolvedOverlayEnteringAnimation) {
    marker.appearAnimation = .none
    marker.iconView = nil
    marker.tracksViewChanges = false

    guard shouldRun(animation) else {
      return
    }

    switch animation.kind {
    case .none:
      return
    case .system:
      marker.appearAnimation = .pop
    case .fade:
      marker.appearAnimation = .fadeIn
    case .fadeScale:
      prepareGoogleFadeScaleMarker(marker)
    }
  }

  static func canAnimateGoogleMarker(_ animation: ResolvedOverlayEnteringAnimation) -> Bool {
    shouldRun(animation)
  }

  static func usesBatchedGoogleMarkerAnimation(_ animation: ResolvedOverlayEnteringAnimation) -> Bool {
    shouldRun(animation) && animation.kind == .fadeScale
  }

  static func showGoogleMarkerWithoutAnimation(_ marker: GMSMarker) {
    marker.appearAnimation = .none
    marker.iconView = nil
    marker.tracksViewChanges = false
  }

  static func animateGoogleMarkers(
    _ markers: [GMSMarker],
    animation: ResolvedOverlayEnteringAnimation
  ) {
    guard shouldRun(animation), animation.kind == .fadeScale else {
      return
    }
    guard !markers.isEmpty else {
      return
    }

    let runAnimations = {
      for marker in markers where marker.map != nil {
        animateGoogleFadeScaleMarker(marker, duration: animation.duration)
      }
    }

    if animation.delay > 0 {
      DispatchQueue.main.asyncAfter(deadline: .now() + animation.delay) {
        runAnimations()
      }
    } else {
      runAnimations()
    }
  }

  private static func prepareGoogleFadeScaleMarker(_ marker: GMSMarker) {
    let image = marker.icon ?? GMSMarker.markerImage(with: nil)
    let imageView = UIImageView(
      frame: CGRect(origin: .zero, size: image.size)
    )
    imageView.image = image
    imageView.contentMode = .scaleAspectFit
    imageView.alpha = 0
    imageView.transform = CGAffineTransform(scaleX: 0.7, y: 0.7)

    marker.iconView = imageView
    marker.tracksViewChanges = true
  }

  private static func animateGoogleFadeScaleMarker(_ marker: GMSMarker, duration: TimeInterval) {
    guard let iconView = marker.iconView else {
      return
    }

    marker.tracksViewChanges = true
    UIView.animate(
      withDuration: duration,
      delay: 0,
      options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut]
    ) {
      iconView.alpha = 1
      iconView.transform = .identity
    } completion: { _ in
      marker.tracksViewChanges = false
      marker.iconView = nil
    }
  }

  private static func seconds(
    fromMilliseconds value: Double?,
    defaultMilliseconds: Double
  ) -> TimeInterval {
    guard let value, value.isFinite else {
      return defaultMilliseconds / 1000
    }
    return min(3000, max(0, value)) / 1000
  }
}
