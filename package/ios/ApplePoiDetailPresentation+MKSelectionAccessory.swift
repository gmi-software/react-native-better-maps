import MapKit
import UIKit

@available(iOS 18.0, *)
extension ApplePoiDetailPresentation {
  /// MapKit selection accessory for this presentation. `presenter` hosts sheets; without one,
  /// `.sheet` degrades to a callout so the place details still show.
  func toMKSelectionAccessory(presentedFrom presenter: UIViewController?) -> MKSelectionAccessory {
    switch self {
    case .automatic:
      return .mapItemDetail(.automatic(presentationViewController: presenter))
    case .callout:
      return .mapItemDetail(.callout(.automatic))
    case .sheet:
      guard let presenter else {
        return .mapItemDetail(.callout(.automatic))
      }
      return .mapItemDetail(.sheet(presentedFrom: presenter))
    case .openinmaps:
      return .mapItemDetail(.openInMaps)
    }
  }
}
