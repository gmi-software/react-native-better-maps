import NitroModules
import UIKit

protocol MapProviderAdapter: AnyObject {
  var contentView: UIView { get }

  var mapType: MapType { get set }
  var region: Region? { get set }
  var camera: Camera? { get set }
  var scrollEnabled: Bool? { get set }
  var zoomEnabled: Bool? { get set }
  var rotateEnabled: Bool? { get set }
  var pitchEnabled: Bool? { get set }
  var showsUserLocation: Bool? { get set }
  var followsUserLocation: Bool? { get set }
  var showsCompass: Bool? { get set }
  var showsScale: Bool? { get set }
  var applePoiDetailPresentation: ApplePoiDetailPresentation? { get set }
  var customMapStyle: String? { get set }
  var googleMapId: String? { get set }
  var clusteringEnabled: Bool? { get set }
  var mapPadding: EdgePadding? { get set }
  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor? { get set }
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? { get set }

  var onRegionChange: ((Region, RegionChangeDetails) -> Void)? { get set }
  var onRegionChangeComplete: ((Region, RegionChangeDetails) -> Void)? { get set }
  var onMapReady: (() -> Void)? { get set }
  var onPress: ((Coordinate) -> Void)? { get set }
  var onPoiPress: ((NativePoiPressEvent) -> Void)? { get set }
  var onLongPress: ((Coordinate) -> Void)? { get set }

  var markers: [MarkerDescriptor]? { get set }
  var polylines: [PolylineDescriptor]? { get set }
  var polygons: [PolygonDescriptor]? { get set }
  var circles: [CircleDescriptor]? { get set }

  var onMarkerPress: ((String) -> Void)? { get set }
  var onMarkerDragEnd: ((String, Coordinate) -> Void)? { get set }
  var onPolylinePress: ((String) -> Void)? { get set }
  var onPolygonPress: ((String) -> Void)? { get set }
  var onCirclePress: ((String) -> Void)? { get set }
  var onClusterPress: (([String], Coordinate) -> Void)? { get set }

  func fetchCamera() throws -> Promise<Camera>

  /// Resolves once the camera has arrived: a non-animated move right away, an animated
  /// one when it finishes or when a gesture, a later command or ``prepareForRecycle()``
  /// cuts it short.
  func applyCamera(camera: Camera) throws -> Promise<Void>

  /// - SeeAlso: ``applyCamera(camera:)`` for when the Promise settles.
  func animateCamera(camera: Camera, duration: Double?) throws -> Promise<Void>

  func getVisibleRegion() throws -> Promise<VisibleRegion>

  /// - SeeAlso: ``applyCamera(camera:)`` for when the Promise settles.
  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws -> Promise<Void>

  func prepareForRecycle()
}

final class UnavailableMapProviderAdapter: MapProviderAdapter {
  let contentView: UIView
  private let error: Error

  var mapType: MapType = .standard
  var region: Region?
  var camera: Camera?
  var scrollEnabled: Bool?
  var zoomEnabled: Bool?
  var rotateEnabled: Bool?
  var pitchEnabled: Bool?
  var showsUserLocation: Bool?
  var followsUserLocation: Bool?
  var showsCompass: Bool?
  var showsScale: Bool?
  var applePoiDetailPresentation: ApplePoiDetailPresentation?
  var customMapStyle: String?
  var googleMapId: String?
  var clusteringEnabled: Bool?
  var mapPadding: EdgePadding?
  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?

  var onRegionChange: ((Region, RegionChangeDetails) -> Void)?
  var onRegionChangeComplete: ((Region, RegionChangeDetails) -> Void)?
  var onMapReady: (() -> Void)?
  var onPress: ((Coordinate) -> Void)?
  var onPoiPress: ((NativePoiPressEvent) -> Void)?
  var onLongPress: ((Coordinate) -> Void)?

  var markers: [MarkerDescriptor]?
  var polylines: [PolylineDescriptor]?
  var polygons: [PolygonDescriptor]?
  var circles: [CircleDescriptor]?

  var onMarkerPress: ((String) -> Void)?
  var onMarkerDragEnd: ((String, Coordinate) -> Void)?
  var onPolylinePress: ((String) -> Void)?
  var onPolygonPress: ((String) -> Void)?
  var onCirclePress: ((String) -> Void)?
  var onClusterPress: (([String], Coordinate) -> Void)?

  init(error: Error) {
    self.error = error

    let view = UIView()
    view.backgroundColor = .systemBackground

    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.text = error.localizedDescription
    label.textAlignment = .center
    label.textColor = .secondaryLabel
    label.font = .preferredFont(forTextStyle: .footnote)
    label.numberOfLines = 0

    view.addSubview(label)
    NSLayoutConstraint.activate([
      label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
      label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])

    contentView = view
  }

  func fetchCamera() throws -> Promise<Camera> {
    Promise.rejected(withError: error)
  }

  func applyCamera(camera: Camera) throws -> Promise<Void> {
    throw error
  }

  func animateCamera(camera: Camera, duration: Double?) throws -> Promise<Void> {
    throw error
  }

  func getVisibleRegion() throws -> Promise<VisibleRegion> {
    Promise.rejected(withError: error)
  }

  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws -> Promise<Void> {
    throw error
  }

  func prepareForRecycle() {}
}
