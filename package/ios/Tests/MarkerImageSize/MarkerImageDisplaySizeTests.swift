import CoreGraphics
import Testing

@testable import NitroMapsMarkerImageSize

@Test
func explicitWidthAndHeightWinOverScale() {
  let size = MarkerImageDisplaySize.points(
    size: CGSize(width: 50, height: 82),
    imageScale: 1,
    width: 37,
    height: 61,
    scale: 2
  )
  #expect(size == CGSize(width: 37, height: 61))
}

@Test
func scaleMapsDecodedPixelsToPoints() {
  // A 50×82 px bitmap authored for a 25×41 pt pin, decoded by `UIImage(data:)` at scale 1.
  let size = MarkerImageDisplaySize.points(
    size: CGSize(width: 50, height: 82),
    imageScale: 1,
    width: nil,
    height: nil,
    scale: 2
  )
  #expect(size == CGSize(width: 25, height: 41))
}

@Test
func imageDecodedAtTheRequestedScaleKeepsItsSize() {
  let size = MarkerImageDisplaySize.points(
    size: CGSize(width: 25, height: 41),
    imageScale: 2,
    width: nil,
    height: nil,
    scale: 2
  )
  #expect(size == CGSize(width: 25, height: 41))
}

@Test
func withoutScaleTheDecodedSizeIsKept() {
  // An asset catalog image carries its own `@3x` scale.
  let size = MarkerImageDisplaySize.points(
    size: CGSize(width: 25, height: 41),
    imageScale: 3,
    width: nil,
    height: nil,
    scale: nil
  )
  #expect(size == CGSize(width: 25, height: 41))
}

@Test
func onlyOneExplicitDimensionFallsBackToScale() {
  let size = MarkerImageDisplaySize.points(
    size: CGSize(width: 60, height: 90),
    imageScale: 1,
    width: 40,
    height: nil,
    scale: 3
  )
  #expect(size == CGSize(width: 20, height: 30))
}

@Test
func unusableScalesDecodeAtOne() {
  #expect(MarkerImageDisplaySize.decodeScale(nil) == 1)
  #expect(MarkerImageDisplaySize.decodeScale(0) == 1)
  #expect(MarkerImageDisplaySize.decodeScale(-2) == 1)
  #expect(MarkerImageDisplaySize.decodeScale(.nan) == 1)
  #expect(MarkerImageDisplaySize.decodeScale(.infinity) == 1)
  #expect(MarkerImageDisplaySize.decodeScale(3) == 3)
}

@Test
func unusableScaleKeepsTheDecodedSize() {
  let size = MarkerImageDisplaySize.points(
    size: CGSize(width: 50, height: 82),
    imageScale: 2,
    width: nil,
    height: nil,
    scale: 0
  )
  #expect(size == CGSize(width: 50, height: 82))
}

@Test
func smallImagesRasterizeAtTheScreenScale() {
  #expect(
    MarkerImageDisplaySize.rasterScale(points: CGSize(width: 37, height: 61), screenScale: 3) == 3)
}

@Test
func largeImagesRasterizeWithinTheBitmapLimits() {
  // 4000×3000 pt at 3× would be a 12000×9000 px bitmap.
  let points = CGSize(width: 4000, height: 3000)
  let scale = MarkerImageDisplaySize.rasterScale(points: points, screenScale: 3)
  let pixelWidth = points.width * scale
  let pixelHeight = points.height * scale
  #expect(pixelWidth <= MarkerImageDisplaySize.maxRasterDimension + 0.001)
  #expect(pixelHeight <= MarkerImageDisplaySize.maxRasterDimension + 0.001)
  #expect(pixelWidth * pixelHeight <= MarkerImageDisplaySize.maxRasterPixels + 1)
  #expect(abs(pixelWidth / pixelHeight - 4.0 / 3.0) < 0.0001)
}

@Test
func longThinImagesAreBoundedBySide() {
  let scale = MarkerImageDisplaySize.rasterScale(
    points: CGSize(width: 10_000, height: 10), screenScale: 2)
  #expect(abs(10_000 * scale - MarkerImageDisplaySize.maxRasterDimension) < 0.001)
}

@Test
func emptySizesKeepTheScreenScale() {
  #expect(MarkerImageDisplaySize.rasterScale(points: .zero, screenScale: 2) == 2)
}
