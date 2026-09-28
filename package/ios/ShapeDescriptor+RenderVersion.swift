/// Render versions for shape overlay descriptors, diffed by
/// `computeShapeRenderDiff`.
///
/// Overlay controllers keep the version of every shape they have shown, so a
/// descriptor that is sent again unchanged costs one hash instead of an SDK
/// call. Geometry and style are versioned apart: a style-only change is applied
/// without touching the geometry, which on MapKit would mean a new overlay.
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
    hasher.combine(zIndex)
    hasher.combine(tappable)
    return hasher.finalize()
  }
}

extension PolygonDescriptor {
  func geometryVersion() -> Int {
    var hasher = Hasher()
    coordinates.hashGeometry(into: &hasher)
    if let holes {
      hasher.combine(true)
      hasher.combine(holes.count)
      for hole in holes {
        hole.hashGeometry(into: &hasher)
      }
    } else {
      hasher.combine(false)
    }
    return hasher.finalize()
  }

  func styleVersion() -> Int {
    var hasher = Hasher()
    hasher.combine(fillColor)
    hasher.combine(strokeColor)
    hasher.combine(strokeWidth)
    hasher.combine(zIndex)
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
