/// Versions of a shown shape overlay, kept per overlay id. Geometry and style
/// are versioned apart because they cost different amounts to apply: geometry
/// is every point of the shape, and on MapKit a new overlay; style is a handful
/// of setters.
struct ShapeRenderVersion: Equatable {
  let geometry: Int
  let style: Int
}

/// A shape to add to the map, or a shown one to update.
struct ShapeRenderChange<Descriptor> {
  let id: String
  let descriptor: Descriptor
  let version: ShapeRenderVersion
  /// Whether the shape's geometry differs from the one on the map; always true
  /// for an added shape.
  let geometryChanged: Bool
  /// Whether the shape's style differs from the one on the map; always true
  /// for an added shape.
  let styleChanged: Bool
}

/// What reconciling one shape kind has to do to the map, with added and updated
/// shapes in descriptor order. A shown shape whose version is unchanged appears
/// nowhere in it, so it costs no SDK call.
struct ShapeRenderDiff<Descriptor> {
  let removedIds: Set<String>
  let added: [ShapeRenderChange<Descriptor>]
  let updated: [ShapeRenderChange<Descriptor>]
}

/// Diffs the next descriptors of one shape kind against the versions of the
/// shapes on the map. When two descriptors share an id, the later one is used.
///
/// `ShapeRenderDiff.kt` is the Android counterpart; change the two together.
func computeShapeRenderDiff<Descriptor>(
  _ descriptors: [Descriptor],
  displayed: [String: ShapeRenderVersion],
  id: (Descriptor) -> String,
  version: (Descriptor) -> ShapeRenderVersion
) -> ShapeRenderDiff<Descriptor> {
  var lastIndexById: [String: Int] = [:]
  lastIndexById.reserveCapacity(descriptors.count)
  for (index, descriptor) in descriptors.enumerated() {
    lastIndexById[id(descriptor)] = index
  }

  var added: [ShapeRenderChange<Descriptor>] = []
  var updated: [ShapeRenderChange<Descriptor>] = []
  for (index, descriptor) in descriptors.enumerated() {
    let descriptorId = id(descriptor)
    guard lastIndexById[descriptorId] == index else {
      continue
    }

    let nextVersion = version(descriptor)
    guard let shown = displayed[descriptorId] else {
      added.append(
        ShapeRenderChange(
          id: descriptorId,
          descriptor: descriptor,
          version: nextVersion,
          geometryChanged: true,
          styleChanged: true
        )
      )
      continue
    }

    if shown != nextVersion {
      updated.append(
        ShapeRenderChange(
          id: descriptorId,
          descriptor: descriptor,
          version: nextVersion,
          geometryChanged: shown.geometry != nextVersion.geometry,
          styleChanged: shown.style != nextVersion.style
        )
      )
    }
  }

  return ShapeRenderDiff(
    removedIds: Set(displayed.keys.filter { lastIndexById[$0] == nil }),
    added: added,
    updated: updated
  )
}
