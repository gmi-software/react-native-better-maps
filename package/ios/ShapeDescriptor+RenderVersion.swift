/// Render versions for shape overlay descriptors.
///
/// Overlay controllers keep the version of every shape they have shown so a
/// descriptor that is sent again unchanged costs one hash instead of a native
/// remove-and-add. Geometry and style are versioned separately: a geometry
/// change needs a new SDK overlay, a style-only change is applied in place.
extension Array where Element == Coordinate {
  func hashGeometry(into hasher: inout Hasher) {
    hasher.combine(count)
    for coordinate in self {
      hasher.combine(coordinate.latitude)
      hasher.combine(coordinate.longitude)
    }
  }
}

extension PolylineDescriptor {
  func geometryVersion() -> Int {
    var hasher = Hasher()
    coordinates.hashGeometry(into: &hasher)
    return hasher.finalize()
  }

  func styleVersion() -> Int {
    var hasher = Hasher()
    hasher.combine(strokeColor)
    hasher.combine(strokeWidth)
    hasher.combine(tappable)
    return hasher.finalize()
  }
}

extension PolygonDescriptor {
  func geometryVersion() -> Int {
    var hasher = Hasher()
    coordinates.hashGeometry(into: &hasher)
    return hasher.finalize()
  }

  func styleVersion() -> Int {
    var hasher = Hasher()
    hasher.combine(fillColor)
    hasher.combine(strokeColor)
    hasher.combine(strokeWidth)
    hasher.combine(tappable)
    return hasher.finalize()
  }
}

extension CircleDescriptor {
  func geometryVersion() -> Int {
    var hasher = Hasher()
    hasher.combine(center.latitude)
    hasher.combine(center.longitude)
    hasher.combine(radius)
    return hasher.finalize()
  }

  func styleVersion() -> Int {
    var hasher = Hasher()
    hasher.combine(fillColor)
    hasher.combine(strokeColor)
    hasher.combine(strokeWidth)
    hasher.combine(tappable)
    return hasher.finalize()
  }
}

/// Geometry and style versions of a shown shape overlay, kept per overlay id.
struct ShapeRenderVersion: Equatable {
  let geometry: Int
  let style: Int
}

extension PolylineDescriptor {
  func renderVersion() -> ShapeRenderVersion {
    ShapeRenderVersion(geometry: geometryVersion(), style: styleVersion())
  }
}

extension PolygonDescriptor {
  func renderVersion() -> ShapeRenderVersion {
    ShapeRenderVersion(geometry: geometryVersion(), style: styleVersion())
  }
}

extension CircleDescriptor {
  func renderVersion() -> ShapeRenderVersion {
    ShapeRenderVersion(geometry: geometryVersion(), style: styleVersion())
  }
}
