import MapKit
import UIKit

/// Circular cluster badge with a gradient fill, soft shadow and member count.
final class NitroClusterAnnotationView: MKAnnotationView {
  static let reuseIdentifier = "NitroCluster"

  private let label = UILabel()
  private let circle = UIView()
  private let gradient = CAGradientLayer()

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

    circle.isUserInteractionEnabled = false
    circle.layer.borderWidth = 2
    circle.layer.borderColor = UIColor.white.cgColor
    circle.layer.shadowColor = UIColor.black.cgColor
    circle.layer.shadowOpacity = 0.28
    circle.layer.shadowRadius = 3
    circle.layer.shadowOffset = CGSize(width: 0, height: 1.5)

    gradient.colors = [
      UIColor(red: 0.30, green: 0.62, blue: 1.0, alpha: 1).cgColor,
      UIColor(red: 0.04, green: 0.52, blue: 1.0, alpha: 1).cgColor,
    ]
    gradient.startPoint = CGPoint(x: 0.5, y: 0)
    gradient.endPoint = CGPoint(x: 0.5, y: 1)
    gradient.masksToBounds = true
    circle.layer.insertSublayer(gradient, at: 0)
    addSubview(circle)

    label.textAlignment = .center
    label.textColor = .white
    label.font = .systemFont(ofSize: 13, weight: .bold)
    label.adjustsFontSizeToFitWidth = true
    label.minimumScaleFactor = 0.6
    label.isUserInteractionEnabled = false
    addSubview(label)
  }

  func configure(count: Int) {
    let diameter = ClusterBadgeMetrics.diameter(for: count)
    let rect = CGRect(x: 0, y: 0, width: diameter, height: diameter)
    bounds = rect
    circle.frame = rect
    circle.layer.cornerRadius = diameter / 2
    circle.layer.shadowPath = UIBezierPath(ovalIn: rect).cgPath
    gradient.frame = rect
    gradient.cornerRadius = diameter / 2
    label.frame = rect
    label.text = Self.format(count)
  }

  static func format(_ count: Int) -> String {
    if count >= 1000 {
      return String(format: "%.1fk", Double(count) / 1000)
    }
    return String(count)
  }
}
