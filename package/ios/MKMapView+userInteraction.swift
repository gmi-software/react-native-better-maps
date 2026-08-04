import MapKit

extension MKMapView {
  var isUserInteracting: Bool {
    return hasActiveGestureRecognizer(in: self)
  }

  private func hasActiveGestureRecognizer(in view: UIView) -> Bool {
    if let recognizers = view.gestureRecognizers,
      recognizers.contains(where: { $0.state == .began || $0.state == .changed })
    {
      return true
    }

    return view.subviews.contains { hasActiveGestureRecognizer(in: $0) }
  }
}
