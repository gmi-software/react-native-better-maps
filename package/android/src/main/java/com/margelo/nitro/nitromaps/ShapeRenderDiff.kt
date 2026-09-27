package com.margelo.nitro.nitromaps

/**
 * Versions of a shown shape overlay, kept per overlay id. Geometry and style
 * are versioned apart because they cost different amounts to apply: geometry
 * is every point of the shape, style is a handful of setters.
 */
internal data class ShapeRenderVersion(
  val geometry: Long,
  val style: Long,
)

/** A shape to add to the map, or a shown one to update in place. */
internal data class ShapeRenderChange<Descriptor>(
  val id: String,
  val descriptor: Descriptor,
  val version: ShapeRenderVersion,
  /** Whether the shape's points differ from the ones on the map; always true for an added shape. */
  val geometryChanged: Boolean,
  /** Whether the shape's style differs from the one on the map; always true for an added shape. */
  val styleChanged: Boolean,
)

/**
 * What reconciling one shape kind has to do to the map, with added and updated
 * shapes in descriptor order. A shown shape whose version is unchanged appears
 * nowhere in it, so it costs no SDK call.
 */
internal data class ShapeRenderDiff<Descriptor>(
  val removedIds: Set<String>,
  val added: List<ShapeRenderChange<Descriptor>>,
  val updated: List<ShapeRenderChange<Descriptor>>,
)

/**
 * Diffs the next descriptors of one shape kind, keyed by id, against the
 * versions of the shapes on the map.
 *
 * `ShapeRenderDiff.swift` is the iOS counterpart; change the two together.
 */
internal fun <Descriptor> computeShapeRenderDiff(
  next: Map<String, Descriptor>,
  displayed: Map<String, ShapeRenderVersion>,
  version: (Descriptor) -> ShapeRenderVersion,
): ShapeRenderDiff<Descriptor> {
  val added = ArrayList<ShapeRenderChange<Descriptor>>()
  val updated = ArrayList<ShapeRenderChange<Descriptor>>()

  for ((id, descriptor) in next) {
    val nextVersion = version(descriptor)
    val shown = displayed[id]
    if (shown == null) {
      added.add(ShapeRenderChange(id, descriptor, nextVersion, geometryChanged = true, styleChanged = true))
    } else if (shown != nextVersion) {
      updated.add(
        ShapeRenderChange(
          id,
          descriptor,
          nextVersion,
          geometryChanged = shown.geometry != nextVersion.geometry,
          styleChanged = shown.style != nextVersion.style,
        ),
      )
    }
  }

  return ShapeRenderDiff(
    removedIds = displayed.keys - next.keys,
    added = added,
    updated = updated,
  )
}
