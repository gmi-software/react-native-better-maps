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
}
