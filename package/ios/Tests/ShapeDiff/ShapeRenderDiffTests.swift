import Testing

@testable import NitroMapsShapeDiff

// ShapeRenderDiffTest.kt checks the same cases on Android, against the real
// descriptors; the Nitro-generated ones do not exist in this package, so the
// shapes here carry their versions directly.

private struct Shape {
  let id: String
  var geometry = 1
  var style = 1

  var version: ShapeRenderVersion {
    ShapeRenderVersion(geometry: geometry, style: style)
  }
}

private func diff(_ next: [Shape], shown: [Shape]) -> ShapeRenderDiff<Shape> {
  computeShapeRenderDiff(
    next,
    displayed: Dictionary(uniqueKeysWithValues: shown.map { ($0.id, $0.version) }),
    id: \.id,
    version: \.version
  )
}

@Test
func addsEveryShapeOfAFirstUpdateInDescriptorOrder() {
  let result = diff([Shape(id: "b"), Shape(id: "a")], shown: [])

  #expect(result.added.map(\.id) == ["b", "a"])
  #expect(result.added.allSatisfy { $0.geometryChanged && $0.styleChanged })
  #expect(result.updated.isEmpty)
  #expect(result.removedIds.isEmpty)
}

@Test
func removesTheShapesThatAreNoLongerSent() {
  let result = diff([Shape(id: "kept")], shown: [Shape(id: "kept"), Shape(id: "gone")])

  #expect(result.removedIds == ["gone"])
  #expect(result.added.isEmpty)
  #expect(result.updated.isEmpty)
}

@Test
func leavesTheShapesAloneWhenTheSameArrayIsSentAgain() {
  let shapes = [Shape(id: "a"), Shape(id: "b", geometry: 2, style: 3)]

  let result = diff(shapes, shown: shapes)

  #expect(result.removedIds.isEmpty)
  #expect(result.added.isEmpty)
  #expect(result.updated.isEmpty)
}

@Test
func updatesOnlyTheLiveRouteWhenOnePointIsAppendedToIt() {
  let statics = (0..<50).map { Shape(id: "static-\($0)", geometry: $0) }
  let live = Shape(id: "live", geometry: 100)
  var appended = live
  appended.geometry = 101

  let result = diff([appended] + statics, shown: [live] + statics)

  #expect(result.updated.map(\.id) == ["live"])
  #expect(result.updated.first?.geometryChanged == true)
  #expect(result.updated.first?.styleChanged == false)
  #expect(result.added.isEmpty)
  #expect(result.removedIds.isEmpty)
}

@Test
func restylesWithoutTouchingTheGeometryWhenOnlyTheStyleChanged() {
  let result = diff([Shape(id: "a", style: 2)], shown: [Shape(id: "a", style: 1)])

  let change = result.updated.first
  #expect(result.updated.count == 1)
  #expect(change?.geometryChanged == false)
  #expect(change?.styleChanged == true)
  #expect(change?.version == ShapeRenderVersion(geometry: 1, style: 2))
}

@Test
func updatesBothWhenTheGeometryAndTheStyleChanged() {
  let result = diff([Shape(id: "a", geometry: 2, style: 2)], shown: [Shape(id: "a")])

  let change = result.updated.first
  #expect(change?.geometryChanged == true)
  #expect(change?.styleChanged == true)
}

@Test
func usesTheLaterOfTwoDescriptorsThatShareAnId() {
  let result = diff([Shape(id: "a", style: 2), Shape(id: "a", style: 3)], shown: [])

  #expect(result.added.map(\.id) == ["a"])
  #expect(result.added.first?.version == ShapeRenderVersion(geometry: 1, style: 3))
}
