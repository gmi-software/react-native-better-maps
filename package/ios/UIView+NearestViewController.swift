import UIKit

extension UIView {
  /// The closest view controller up the responder chain.
  var nearestViewController: UIViewController? {
    var responder: UIResponder? = next
    while let current = responder {
      if let controller = current as? UIViewController {
        return controller
      }
      responder = current.next
    }
    return nil
  }
}
