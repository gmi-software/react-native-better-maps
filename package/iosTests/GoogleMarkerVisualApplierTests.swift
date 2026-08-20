import GoogleMaps
import UIKit
import XCTest

@testable import NitroMaps

final class GoogleMarkerVisualApplierTests: XCTestCase {
  func testSameUncachedImageKeepsTheLaterAnchor() {
    var completions: [(UIImage?) -> Void] = []
    let applier = GoogleMarkerVisualApplier(
      cachedImage: { _ in nil },
      loadImage: { _, completion in completions.append(completion) }
    )
    let marker = GMSMarker()
    let image = MarkerImage(
      uri: "https://example.test/pin.png",
      width: 40,
      height: 40,
      scale: 1
    )

    applier.apply(markerDescriptor(image: image, anchor: MarkerAnchor(x: 0, y: 0)), to: marker)
    applier.apply(markerDescriptor(image: image, anchor: MarkerAnchor(x: 1, y: 1)), to: marker)

    XCTAssertEqual(completions.count, 1)

    completions[0](makeIcon())

    XCTAssertEqual(marker.groundAnchor.x, 1, accuracy: 0.0001)
    XCTAssertEqual(marker.groundAnchor.y, 1, accuracy: 0.0001)
  }

  func testAppliedImageIsNotReplacedByAStalePendingLoad() {
    let iconA = makeIcon()
    let iconB = makeIcon()
    var completions: [(UIImage?) -> Void] = []
    let imageA = MarkerImage(
      uri: "https://example.test/a.png",
      width: 40,
      height: 40,
      scale: 1
    )
    let imageB = MarkerImage(
      uri: "https://example.test/b.png",
      width: 40,
      height: 40,
      scale: 1
    )
    let applier = GoogleMarkerVisualApplier(
      cachedImage: { image in image.uri.hasSuffix("a.png") ? iconA : nil },
      loadImage: { _, completion in completions.append(completion) }
    )
    let marker = GMSMarker()

    applier.apply(markerDescriptor(image: imageA, anchor: MarkerAnchor(x: 0, y: 0)), to: marker)
    applier.apply(markerDescriptor(image: imageB, anchor: MarkerAnchor(x: 1, y: 1)), to: marker)
    applier.apply(markerDescriptor(image: imageA, anchor: MarkerAnchor(x: 0, y: 0)), to: marker)

    XCTAssertEqual(completions.count, 1)
    completions[0](iconB)

    XCTAssertTrue(marker.icon === iconA)
    XCTAssertEqual(marker.groundAnchor.x, 0, accuracy: 0.0001)
    XCTAssertEqual(marker.groundAnchor.y, 0, accuracy: 0.0001)
  }
}

private func markerDescriptor(image: MarkerImage, anchor: MarkerAnchor) -> MarkerDescriptor {
  MarkerDescriptor(
    id: "marker",
    coordinate: Coordinate(latitude: 0, longitude: 0),
    title: nil,
    subtitle: nil,
    draggable: nil,
    clusterable: nil,
    image: image,
    anchor: anchor,
    centerOffset: nil,
    rotation: nil,
    flat: nil,
    opacity: nil,
    enteringAnimation: nil
  )
}

private func makeIcon() -> UIImage {
  UIGraphicsImageRenderer(size: CGSize(width: 40, height: 40)).image { _ in }
}
