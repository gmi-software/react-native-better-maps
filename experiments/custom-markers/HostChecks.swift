import UIKit

// Match the generated data fields without linking Nitro in this isolated test app.
struct Coordinate { var latitude: Double; var longitude: Double }
struct MarkerAnchor { var x: Double; var y: Double }

func runNativeHostChecks() {
  let map = NitroMapContainerView(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
  let secondMap = NitroMapContainerView(frame: map.frame)
  let surface = UIView(frame: map.bounds)
  map.addSubview(surface)
  map.mapSurface = surface
  var projection = CGPoint(x: 200, y: 150)
  map.projectCoordinate = { _ in projection }
  secondMap.projectCoordinate = { _ in CGPoint(x: 40, y: 40) }
  let wrapper = UIView(frame: CGRect(x: 0, y: 0, width: 96, height: 48))
  let content = NitroMarkerContentView(frame: wrapper.bounds)
  precondition(content.clipsToBounds, "Animated descendants stay inside marker bounds")
  let button = UIButton(frame: content.bounds)
  content.addSubview(button)
  content.coordinate = Coordinate(latitude: 52, longitude: 21)
  wrapper.addSubview(content)
  map.mountFabricChild(wrapper, at: 0)
  precondition(wrapper.superview === surface, "Fabric host inherits SDK gesture ancestors")
  precondition(wrapper.frame.origin == CGPoint(x: 152, y: 102), "Bottom-center anchor")
  precondition(map.hitTest(CGPoint(x: 200, y: 126), with: nil) === button, "Translated child hit testing")
  content.anchor = MarkerAnchor(x: 0, y: 0)
  content.updatePosition()
  precondition(wrapper.frame.origin == projection, "Anchor update")
  projection = CGPoint(x: -200, y: 150)
  map.updateMarkerPositions()
  precondition(wrapper.isHidden, "Offscreen host is culled")
  projection = CGPoint(x: 100, y: 100)
  map.updateMarkerPositions()
  precondition(!wrapper.isHidden && wrapper.frame.origin == projection, "Reentry restores position")
  let replacementSurface = UIView(frame: map.bounds)
  map.addSubview(replacementSurface)
  map.mapSurface = replacementSurface
  surface.removeFromSuperview()
  precondition(wrapper.superview === replacementSurface, "Provider replacement preserves live Fabric hosts")
  projection = CGPoint(x: CGFloat.nan, y: 0)
  map.updateMarkerPositions()
  precondition(wrapper.isHidden, "Non-finite projection is hidden")
  map.unmountFabricChild(wrapper)
  precondition(content.mapContainer == nil && content.fabricHost == nil, "Unmount releases association")
  precondition(wrapper.transform == .identity && !wrapper.isHidden, "Unmount resets host state")
  secondMap.mountFabricChild(wrapper, at: 0)
  precondition(wrapper.frame.origin == CGPoint(x: 40, y: 40), "Mount in another map")
  projection = CGPoint(x: 300, y: 300)
  map.updateMarkerPositions()
  precondition(wrapper.frame.origin == CGPoint(x: 40, y: 40), "Former map cannot move host")
  secondMap.projectCoordinate = nil
  secondMap.updateMarkerPositions()
  precondition(wrapper.isHidden, "Released projector hides retained host")

  let clippingHost = UIView(frame: CGRect(x: 0, y: 0, width: 120, height: 80))
  clippingHost.backgroundColor = .white
  let clippingContent = NitroMarkerContentView(frame: CGRect(x: 10, y: 10, width: 96, height: 48))
  clippingHost.addSubview(clippingContent)
  let overflowing = UIView(frame: clippingContent.bounds)
  overflowing.backgroundColor = .red
  overflowing.transform = CGAffineTransform(scaleX: 2, y: 2)
  clippingContent.mountFabricChild(overflowing, at: 0)
  let format = UIGraphicsImageRendererFormat()
  format.scale = 1
  let image = UIGraphicsImageRenderer(size: clippingHost.bounds.size, format: format).image {
    clippingHost.layer.render(in: $0.cgContext)
  }.cgImage!
  var pixels = [UInt8](repeating: 0, count: 120 * 80 * 4)
  let context = CGContext(data: &pixels, width: 120, height: 80, bitsPerComponent: 8,
    bytesPerRow: 120 * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  context.draw(image, in: clippingHost.bounds)
  // Check the green channel across the entire raster: red is confined to the
  // expected rectangle even though the child has a 2x animation transform.
  let redPixels = stride(from: 1, to: pixels.count, by: 4).filter { pixels[$0] < 128 }.count
  precondition(redPixels == 96 * 48, "Scaled JSX content is clipped in the rendered output")
  print("NATIVE_HOST_CHECKS_PASSED: anchor, hit testing, culling, reentry, invalid projection, unmount, map isolation, SDK mount, raster clipping")
}
