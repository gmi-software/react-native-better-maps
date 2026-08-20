import CoreGraphics

extension MarkerDescriptor {
  func effectiveGoogleMapsAnchor(imageSize: CGSize) -> CGPoint {
    let anchorX = anchor?.x ?? 0.5
    let anchorY = anchor?.y ?? 1.0
    guard imageSize.width > 0, imageSize.height > 0 else {
      return CGPoint(x: anchorX, y: anchorY)
    }

    let offsetX = centerOffset?.x ?? 0
    let offsetY = centerOffset?.y ?? 0
    return CGPoint(
      x: anchorX - offsetX / imageSize.width,
      y: anchorY - offsetY / imageSize.height
    )
  }
}
