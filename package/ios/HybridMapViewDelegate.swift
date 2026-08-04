import MapKit
import UIKit

/// Delegate and gesture handler for the Apple MapKit provider adapter.
final class HybridMapViewDelegate: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
  weak var parent: AppleMapProviderAdapter?
  private var handledMapFeatureSelections = Set<ObjectIdentifier>()
  private var shouldSuppressNextBackgroundPress = false

  func installGestureRecognizers(on mapView: MKMapView) {
    let tapRecognizer = UITapGestureRecognizer(
      target: self,
      action: #selector(handleTap(_:))
    )
    tapRecognizer.delegate = self
    mapView.addGestureRecognizer(tapRecognizer)

    let longPressRecognizer = UILongPressGestureRecognizer(
      target: self,
      action: #selector(handleLongPress(_:))
    )
    longPressRecognizer.minimumPressDuration = 0.5
    longPressRecognizer.delegate = self
    mapView.addGestureRecognizer(longPressRecognizer)
  }

  @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
    guard recognizer.state == .ended, let parent else {
      return
    }

    let point = recognizer.location(in: parent.view)
    if parent.notifyOverlayPress(at: point) {
      return
    }

    if isAnnotationView(at: point, in: parent.view) {
      return
    }

    DispatchQueue.main.async { [weak self, weak parent] in
      guard let self, let parent else {
        return
      }

      if self.shouldSuppressNextBackgroundPress {
        self.shouldSuppressNextBackgroundPress = false
        return
      }

      parent.notifyPress(at: point)
    }
  }

  @objc private func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
    guard recognizer.state == .began, let parent else {
      return
    }

    let point = recognizer.location(in: parent.view)
    parent.notifyLongPress(at: point)
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    true
  }

  private func isAnnotationView(at point: CGPoint, in mapView: MKMapView) -> Bool {
    var view: UIView? = mapView.hitTest(point, with: nil)
    while let current = view {
      if current is MKAnnotationView {
        return true
      }
      view = current.superview
    }
    return false
  }

  func mapView(_ mapView: MKMapView, regionWillChangeAnimated animated: Bool) {
    parent?.handleRegionWillChange(userInteracting: mapView.isUserInteracting)
  }

  func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
    parent?.handleRegionDidChange()
  }

  func mapViewDidFinishLoadingMap(_ mapView: MKMapView) {
    parent?.notifyMapReadyIfNeeded()
  }

  func mapViewDidFinishRenderingMap(_ mapView: MKMapView, fullyRendered: Bool) {
    guard fullyRendered else {
      return
    }

    parent?.notifyMapReadyIfNeeded()
  }

  func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
    if let cluster = annotation as? MapClusterAnnotation {
      let view = mapView.dequeueReusableAnnotationView(
        withIdentifier: NitroClusterAnnotationView.reuseIdentifier
      ) as? NitroClusterAnnotationView
        ?? NitroClusterAnnotationView(
          annotation: cluster,
          reuseIdentifier: NitroClusterAnnotationView.reuseIdentifier
        )

      view.annotation = cluster
      view.configure(count: cluster.count)
      return view
    }

    guard let marker = annotation as? MapMarkerAnnotation else {
      return nil
    }

    if marker.image != nil {
      let imageView = mapView.dequeueReusableAnnotationView(
        withIdentifier: NitroImageAnnotationView.reuseIdentifier,
        for: marker
      ) as! NitroImageAnnotationView

      imageView.configure(for: marker)
      return imageView
    }

    let pinView = mapView.dequeueReusableAnnotationView(
      withIdentifier: NitroPinAnnotationView.reuseIdentifier,
      for: marker
    ) as! NitroPinAnnotationView

    pinView.configure(for: marker)
    return pinView
  }

  func mapView(_ mapView: MKMapView, didAdd views: [MKAnnotationView]) {
    for view in views {
      if let marker = view.annotation as? MapMarkerAnnotation,
         marker.enteringAnimation.kind != .system {
        OverlayEnteringAnimationResolver.animateAnnotationView(
          view,
          animation: marker.enteringAnimation,
          supportsScale: true
        )
      } else if let cluster = view.annotation as? MapClusterAnnotation,
                cluster.enteringAnimation.kind != .system {
        OverlayEnteringAnimationResolver.animateAnnotationView(
          view,
          animation: cluster.enteringAnimation,
          supportsScale: true
        )
      }
    }
  }

  func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
    if #available(iOS 16.0, *),
       let mapFeature = view.annotation as? MKMapFeatureAnnotation,
       handleMapFeatureSelection(mapFeature) {
      return
    }

    if let cluster = view.annotation as? MapClusterAnnotation {
      let coordinate = cluster.coordinate
      parent?.onClusterPress?(
        cluster.memberIds,
        Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude)
      )
      parent?.animateToClusterRegion(cluster.region)
      mapView.deselectAnnotation(cluster, animated: false)
      return
    }

    guard let marker = view.annotation as? MapMarkerAnnotation else {
      return
    }

    parent?.onMarkerPress?(marker.id)
    if marker.title == nil && marker.subtitle == nil {
      mapView.deselectAnnotation(view.annotation, animated: true)
    }
  }

  func mapView(_ mapView: MKMapView, didSelect annotation: MKAnnotation) {
    if #available(iOS 16.0, *),
       let mapFeature = annotation as? MKMapFeatureAnnotation {
      _ = handleMapFeatureSelection(mapFeature)
    }
  }

  @available(iOS 16.0, *)
  private func handleMapFeatureSelection(_ mapFeature: MKMapFeatureAnnotation) -> Bool {
    guard mapFeature.featureType == .pointOfInterest else {
      return false
    }

    let mapFeatureID = ObjectIdentifier(mapFeature)
    guard !handledMapFeatureSelections.contains(mapFeatureID) else {
      return true
    }

    handledMapFeatureSelections.insert(mapFeatureID)
    shouldSuppressNextBackgroundPress = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
      self?.handledMapFeatureSelections.remove(mapFeatureID)
      self?.shouldSuppressNextBackgroundPress = false
    }

    parent?.notifyPoiPress(annotation: mapFeature)
    return true
  }

  func mapView(
    _ mapView: MKMapView,
    annotationView view: MKAnnotationView,
    didChange newState: MKAnnotationView.DragState,
    fromOldState oldState: MKAnnotationView.DragState
  ) {
    guard newState == .ending,
          let marker = view.annotation as? MapMarkerAnnotation else {
      return
    }

    parent?.onMarkerDragEnd?(
      marker.id,
      Coordinate(
        latitude: marker.coordinate.latitude,
        longitude: marker.coordinate.longitude
      )
    )
  }

  func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
    if let renderer = parent?.renderer(for: overlay) {
      return renderer
    }

    return MKOverlayRenderer(overlay: overlay)
  }
}
