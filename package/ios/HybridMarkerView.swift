import UIKit

final class HybridMarkerView: HybridMarkerViewSpec {
  private let content = NitroMarkerContentView()
  var view: UIView { content }

  var coordinate = Coordinate(latitude: 0, longitude: 0) {
    didSet { content.coordinate = coordinate }
  }
  var anchor: MarkerAnchor? {
    didSet { content.anchor = anchor }
  }

  func afterUpdate() {
    content.updatePosition()
  }
}
