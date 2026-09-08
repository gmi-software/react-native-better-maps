import MapKit
import UIKit

/// One displayed element as the sprite renderer draws it.
struct MarkerSprite {
  let key: MarkerRenderKey
  let element: MarkerRenderElement
  let coordinate: CLLocationCoordinate2D
  let mapPoint: MKMapPoint
  /// Bitmap at the screen scale; nil while a marker image is still loading.
  var image: CGImage?
  /// Drawn size, in points.
  var size: CGSize
  /// The extent that answers to taps, in points: the pin or image itself, or
  /// a cluster's circle without the room its bitmap keeps for the shadow.
  var hitSize: CGSize
  /// Offset of the image centre from the coordinate, in points, y down.
  var centerOffset: CGPoint
  /// Radians, clockwise on screen.
  let rotation: CGFloat
  let opacity: CGFloat

  var isCluster: Bool {
    if case .cluster = element {
      return true
    }
    return false
  }

  /// Distance from the coordinate to the farthest drawn pixel, in points.
  var reach: CGFloat {
    max(size.width, size.height) / 2 + (centerOffset.x * centerOffset.x + centerOffset.y * centerOffset.y).squareRoot()
  }
}

/// An immutable set of sprites in draw order: singles north to south, so the
/// southern pins overlap the northern ones the way pins stack, then cluster
/// badges on top.
final class MarkerSpriteSnapshot {
  let sprites: [MarkerSprite]
  /// The largest `reach` of any sprite, for hit-test pre-filtering.
  let maxReach: CGFloat

  init(sprites: [MarkerSprite]) {
    self.sprites = sprites
    maxReach = sprites.reduce(0) { max($0, $1.reach) }
  }

  static let empty = MarkerSpriteSnapshot(sprites: [])

  static func ordered(_ sprites: [MarkerSprite]) -> MarkerSpriteSnapshot {
    MarkerSpriteSnapshot(sprites: sprites.sorted { lhs, rhs in
      if lhs.isCluster != rhs.isCluster {
        return !lhs.isCluster
      }
      return lhs.coordinate.latitude > rhs.coordinate.latitude
    })
  }
}

/// Hands the current snapshot from the main thread to MapKit's drawing threads.
final class MarkerSpriteSnapshotHolder {
  private let lock = NSLock()
  private var snapshot = MarkerSpriteSnapshot.empty

  var current: MarkerSpriteSnapshot {
    lock.lock()
    defer { lock.unlock() }
    return snapshot
  }

  func replace(_ next: MarkerSpriteSnapshot) {
    lock.lock()
    snapshot = next
    lock.unlock()
  }
}

/// World-sized overlay whose renderer draws the marker sprites.
final class MarkerSpriteOverlay: NSObject, MKOverlay {
  let snapshots = MarkerSpriteSnapshotHolder()

  var coordinate: CLLocationCoordinate2D {
    CLLocationCoordinate2D(latitude: 0, longitude: 0)
  }

  var boundingMapRect: MKMapRect {
    .world
  }
}

/// Draws marker pins, marker images and cluster badges into map tiles.
///
/// MapKit calls `draw` per tile on its own threads and composites the tiles on
/// the GPU, so a pan moves the sprites at no main-thread cost and a viewport
/// change re-renders bitmaps instead of laying out views. Sprites keep the
/// screen size of the zoom scale a tile was drawn for; during a pinch MapKit
/// scales the tiles it has until it has drawn new ones, as it does for every
/// overlay renderer.
final class MarkerSpriteRenderer: MKOverlayRenderer {
  private let snapshots: MarkerSpriteSnapshotHolder

  init(overlay: MarkerSpriteOverlay) {
    snapshots = overlay.snapshots
    super.init(overlay: overlay)
  }

  override func canDraw(_ mapRect: MKMapRect, zoomScale: MKZoomScale) -> Bool {
    !snapshots.current.sprites.isEmpty
  }

  override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
    guard zoomScale > 0 else {
      return
    }
    let sprites = snapshots.current.sprites
    // Map points per screen point at this tile's zoom scale.
    let scale = 1 / CGFloat(zoomScale)

    for sprite in sprites {
      guard let image = sprite.image else {
        continue
      }
      let width = sprite.size.width * scale
      let height = sprite.size.height * scale
      let centerX = sprite.mapPoint.x + sprite.centerOffset.x * scale
      let centerY = sprite.mapPoint.y + sprite.centerOffset.y * scale
      // Cull on the rotated extent; a sprite that touches the tile draws whole.
      let halfDiagonal = (width * width + height * height).squareRoot() / 2
      let reach = MKMapRect(
        x: centerX - halfDiagonal,
        y: centerY - halfDiagonal,
        width: halfDiagonal * 2,
        height: halfDiagonal * 2
      )
      guard mapRect.intersects(reach) else {
        continue
      }

      // Map points go through the renderer's own conversion into its drawing
      // space, as every overlay renderer's content should.
      let drawRect = rect(for: MKMapRect(x: centerX - width / 2, y: centerY - height / 2, width: width, height: height))
      context.saveGState()
      context.translateBy(x: drawRect.midX, y: drawRect.midY)
      if sprite.rotation != 0 {
        context.rotate(by: sprite.rotation)
      }
      // The drawing space is y-down; CGImage drawing is y-up.
      context.scaleBy(x: 1, y: -1)
      context.setAlpha(sprite.opacity)
      context.draw(
        image,
        in: CGRect(x: -drawRect.width / 2, y: -drawRect.height / 2, width: drawRect.width, height: drawRect.height)
      )
      context.restoreGState()
    }
  }
}

/// Draws the cluster badge once per count and screen scale: the look of
/// `NitroClusterAnnotationView` as a bitmap, with room for its shadow.
enum ClusterBadgeImageRenderer {
  /// Room around the circle for the shadow.
  static let margin: CGFloat = 5
  private static let cache: NSCache<NSString, UIImage> = {
    let cache = NSCache<NSString, UIImage>()
    cache.countLimit = 512
    return cache
  }()

  static func badge(count: Int, scale: CGFloat) -> UIImage {
    let renderScale = scale > 0 ? scale : UIScreen.main.scale
    let key = "\(count)@\(renderScale)" as NSString
    if let cached = cache.object(forKey: key) {
      return cached
    }

    let diameter = ClusterBadgeMetrics.diameter(for: count)
    let side = diameter + margin * 2
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = renderScale
    let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { context in
      let cg = context.cgContext
      let circle = CGRect(x: margin, y: margin, width: diameter, height: diameter)
      let path = UIBezierPath(ovalIn: circle)

      cg.saveGState()
      cg.setShadow(
        offset: CGSize(width: 0, height: 1.5),
        blur: 3,
        color: UIColor.black.withAlphaComponent(0.28).cgColor
      )
      UIColor(red: 0.04, green: 0.52, blue: 1.0, alpha: 1).setFill()
      path.fill()
      cg.restoreGState()

      cg.saveGState()
      path.addClip()
      let colors = [
        UIColor(red: 0.30, green: 0.62, blue: 1.0, alpha: 1).cgColor,
        UIColor(red: 0.04, green: 0.52, blue: 1.0, alpha: 1).cgColor,
      ] as CFArray
      if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
        cg.drawLinearGradient(
          gradient,
          start: CGPoint(x: circle.midX, y: circle.minY),
          end: CGPoint(x: circle.midX, y: circle.maxY),
          options: []
        )
      }
      cg.restoreGState()

      let border = UIBezierPath(ovalIn: circle.insetBy(dx: 1, dy: 1))
      border.lineWidth = 2
      UIColor.white.setStroke()
      border.stroke()

      let text = NitroClusterAnnotationView.format(count) as NSString
      let maxWidth = diameter - 8
      var fontSize: CGFloat = 13
      var attributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: fontSize, weight: .bold),
        .foregroundColor: UIColor.white,
      ]
      var textSize = text.size(withAttributes: attributes)
      if textSize.width > maxWidth {
        fontSize = max(fontSize * 0.6, fontSize * maxWidth / textSize.width)
        attributes[.font] = UIFont.systemFont(ofSize: fontSize, weight: .bold)
        textSize = text.size(withAttributes: attributes)
      }
      text.draw(
        at: CGPoint(x: circle.midX - textSize.width / 2, y: circle.midY - textSize.height / 2),
        withAttributes: attributes
      )
    }
    cache.setObject(image, forKey: key)
    return image
  }
}
