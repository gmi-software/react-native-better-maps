import MapKit

extension MKMapView {
  var isUserInteracting: Bool {
    guard let recognizers = subviews.first?.gestureRecognizers else {
      return false
    }

    return recognizers.contains { recognizer in
      recognizer.state == .began || recognizer.state == .changed
    }
  }
}
