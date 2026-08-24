package com.margelo.nitro.nitromaps

import android.view.View
import com.margelo.nitro.core.Promise

interface MapProviderAdapter {
  val view: View

  var mapType: MapType
  var region: Region?
  var camera: Camera?
  var scrollEnabled: Boolean?
  var zoomEnabled: Boolean?
  var rotateEnabled: Boolean?
  var pitchEnabled: Boolean?
  var showsUserLocation: Boolean?
  var followsUserLocation: Boolean?
  var showsCompass: Boolean?
  var showsScale: Boolean?
  var customMapStyle: String?
  var googleMapId: String?
  var clusteringEnabled: Boolean?
  var mapPadding: EdgePadding?
  var markerEnteringAnimation: OverlayEnteringAnimationDescriptor?
  var clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?

  var onRegionChange: ((region: Region) -> Unit)?
  var onRegionChangeComplete: ((region: Region) -> Unit)?
  var onMapReady: (() -> Unit)?
  var onPress: ((coordinate: Coordinate) -> Unit)?
  var onPoiPress: ((event: NativePoiPressEvent) -> Unit)?
  var onLongPress: ((coordinate: Coordinate) -> Unit)?

  var markers: Array<MarkerDescriptor>?
  var polylines: Array<PolylineDescriptor>?
  var polygons: Array<PolygonDescriptor>?
  var circles: Array<CircleDescriptor>?

  var onMarkerPress: ((id: String) -> Unit)?
  var onMarkerDragEnd: ((id: String, coordinate: Coordinate) -> Unit)?
  var onPolylinePress: ((id: String) -> Unit)?
  var onPolygonPress: ((id: String) -> Unit)?
  var onCirclePress: ((id: String) -> Unit)?
  var onClusterPress: ((markerIds: Array<String>, coordinate: Coordinate) -> Unit)?

  fun fetchCamera(): Promise<Camera>
  fun applyCamera(camera: Camera)
  fun animateCamera(camera: Camera, duration: Double?)
  fun getVisibleRegion(): Promise<VisibleRegion>
  fun fitToCoordinates(coordinates: Array<Coordinate>, padding: EdgePadding?, animated: Boolean?)

  /**
   * Destroys the underlying native map and unregisters everything the adapter owns.
   * Every caller discards the adapter afterwards, so this is a one-way transition --
   * it is not the Nitro `RecyclableView.prepareForRecycle` reset. Leaving the window
   * does not trigger it; a detached map is only stopped.
   */
  fun release()
}
