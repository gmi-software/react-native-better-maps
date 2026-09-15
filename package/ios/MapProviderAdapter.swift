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
  var customMapStyle: String? { get set }
  var googleMapId: String? { get set }
  var clusteringEnabled: Bool? { get set }
  var mapPadding: EdgePadding? { get set }
  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor? { get set }
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor? { get set }
  var pinStyle: MarkerPinStyle? { get set }
  var markerRendering: MarkerRendering? { get set }

  var onRegionChange: ((Region) -> Void)? { get set }
  var onRegionChangeComplete: ((Region) -> Void)? { get set }
  var onCameraMove: ((Camera) -> Void)? { get set }
  var cameraMoveThrottleMs: Double? { get set }
  var onMapReady: (() -> Void)? { get set }
  var onPress: ((Coordinate) -> Void)? { get set }
  var onPoiPress: ((NativePoiPressEvent) -> Void)? { get set }
  var onLongPress: ((Coordinate) -> Void)? { get set }

  var markerCollection: HybridMarkerCollection? { get set }
  var polylines: [PolylineDescriptor]? { get set }
  var polygons: [PolygonDescriptor]? { get set }
  var circles: [CircleDescriptor]? { get set }

  var onMarkerPress: ((String) -> Void)? { get set }
  var onMarkerDragEnd: ((String, Coordinate) -> Void)? { get set }
  var onPolylinePress: ((String) -> Void)? { get set }
  var onPolygonPress: ((String) -> Void)? { get set }
  var onCirclePress: ((String) -> Void)? { get set }
  var onClusterPress: ((NativeClusterPressEvent) -> Void)? { get set }

  func fetchCamera() throws -> Promise<Camera>
  func applyCamera(camera: Camera) throws
  func animateCamera(camera: Camera, duration: Double?) throws
  func getVisibleRegion() throws -> Promise<VisibleRegion>
  func fitToCoordinates(coordinates: [Coordinate], padding: EdgePadding?, animated: Bool?) throws
  func getClusterMembers(clusterId: String) throws -> Promise<[String]>
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
  var customMapStyle: String?
  var googleMapId: String?
  var clusteringEnabled: Bool?
  var mapPadding: EdgePadding?
  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var pinStyle: MarkerPinStyle?
  var markerRendering: MarkerRendering?

  var onRegionChange: ((Region) -> Void)?
  var onRegionChangeComplete: ((Region) -> Void)?
  var onCameraMove: ((Camera) -> Void)?
  var cameraMoveThrottleMs: Double?
  var onMapReady: (() -> Void)?
  var onPress: ((Coordinate) -> Void)?
  var onPoiPress: ((NativePoiPressEvent) -> Void)?
  var onLongPress: ((Coordinate) -> Void)?

  var markerCollection: HybridMarkerCollection?
  var polylines: [PolylineDescriptor]?
  var polygons: [PolygonDescriptor]?
  var circles: [CircleDescriptor]?

  var onMarkerPress: ((String) -> Void)?
  var onMarkerDragEnd: ((String, Coordinate) -> Void)?
  var onPolylinePress: ((String) -> Void)?
  var onPolygonPress: ((String) -> Void)?
  var onCirclePress: ((String) -> Void)?
  var onClusterPress: ((NativeClusterPressEvent) -> Void)?

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

  func applyCamera(camera: Camera) throws {
    throw error
  }

  func animateCamera(camera: Camera, duration: Double?) throws {
    throw error
  }

  func getVisibleRegion() throws -> Promise<VisibleRegion> {
    Promise.rejected(withError: error)
  }

  func fitToCoordinates(
    coordinates: [Coordinate],
    padding: EdgePadding?,
    animated: Bool?
  ) throws {
    throw error
  }

  func getClusterMembers(clusterId: String) throws -> Promise<[String]> {
    Promise.rejected(withError: error)
  }

  func prepareForRecycle() {}
}
