import CoreGraphics

/// How large a marker image is drawn, in points. Mirrors `MarkerImage+DisplaySize.kt`.
enum MarkerImageDisplaySize {
  /// The scale raw image bytes are decoded at: `MarkerImage.scale` when it is usable, else 1,
  /// which is what `UIImage(data:)` assumes.
  static func decodeScale(_ scale: Double?) -> CGFloat {
    guard let scale, scale.isFinite, scale > 0 else {
      return 1
    }
    return CGFloat(scale)
  }

  /// An explicit `width` and `height` win. Otherwise a usable `scale` maps the decoded pixels to
  /// points, and without one the image keeps the size it was decoded at — an asset catalog image
  /// already carries its `@2x`/`@3x` scale.
  ///
  /// - Parameters:
  ///   - size: the decoded image's `size`, in points.
  ///   - imageScale: the decoded image's `scale`, so `size * imageScale` is its pixel size.
  static func points(
    size: CGSize,
    imageScale: CGFloat,
    width: Double?,
    height: Double?,
    scale: Double?
  ) -> CGSize {
    if let width, let height, width > 0, height > 0 {
      return CGSize(width: width, height: height)
    }
    guard let scale, scale.isFinite, scale > 0 else {
      return size
    }
    let pixelsPerPoint = imageScale / CGFloat(scale)
    return CGSize(width: size.width * pixelsPerPoint, height: size.height * pixelsPerPoint)
  }

  /// Same limits as `MAX_DECODE_DIMENSION` / `MAX_DECODE_PIXELS` in `MarkerIconFactory.kt`.
  static let maxRasterDimension: CGFloat = 2048
  static let maxRasterPixels: CGFloat = 2048 * 2048

  /// The scale to rasterize `points` at: `screenScale`, lowered until neither side of the bitmap
  /// exceeds `maxRasterDimension` pixels and its area stays within `maxRasterPixels`, so a large
  /// `width`/`height` cannot allocate an unbounded bitmap. The point size, and so the size on the
  /// map, stays the same.
  static func rasterScale(points: CGSize, screenScale: CGFloat) -> CGFloat {
    let longestSide = max(points.width, points.height)
    let area = points.width * points.height
    guard longestSide > 0, area > 0 else {
      return screenScale
    }
    return min(
      screenScale,
      maxRasterDimension / longestSide,
      (maxRasterPixels / area).squareRoot()
    )
  }
}
