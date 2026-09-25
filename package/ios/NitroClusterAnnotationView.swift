import MapKit
import UIKit

/// Cluster badge on Apple Maps: the image `ClusterBadgeRenderer` draws for every provider.
final class NitroClusterAnnotationView: MKAnnotationView {
  static let reuseIdentifier = "NitroCluster"

  private let badge = UIImageView()

  override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
    super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
    setUp()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  private func setUp() {
    canShowCallout = false
    displayPriority = .required
    collisionMode = .circle
    centerOffset = .zero

    isAccessibilityElement = true
    accessibilityTraits = .button
    badge.isAccessibilityElement = false

    badge.isUserInteractionEnabled = false
    addSubview(badge)
  }

  func configure(count: Int) {
    let diameter = ClusterBadgeMetrics.diameter(for: count)
    // The bounds stay the circle, which MapKit hit-tests and collides; the image
    // overhangs them on every side to fit the shadow.
    bounds = CGRect(x: 0, y: 0, width: diameter, height: diameter)
    let outset = ClusterBadgeStyle.shadowOutset
    badge.frame = bounds.insetBy(dx: -outset, dy: -outset)
    badge.image = ClusterBadgeRenderer.image(count: count)

    accessibilityLabel = String.localizedStringWithFormat(
      NSLocalizedString("%d markers in this cluster", comment: "Map marker cluster"),
      count
    )
    accessibilityHint = NSLocalizedString("Double tap to zoom in", comment: "Map marker cluster hint")
  }
}
