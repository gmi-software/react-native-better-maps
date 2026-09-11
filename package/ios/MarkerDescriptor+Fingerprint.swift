extension MarkerDescriptor {
  /// Combines optionals as-is so `nil` stays distinguishable from a present value.
  private func hashDisplayedIdentity(into hasher: inout Hasher) {
    hasher.combine(id)
    hasher.combine(coordinate.latitude)
    hasher.combine(coordinate.longitude)
    hasher.combine(title)
    hasher.combine(subtitle)
    hasher.combine(draggable)
    hasher.combine(clusterable)
    hasher.combine(image?.uri)
    hasher.combine(image?.width)
    hasher.combine(image?.height)
    hasher.combine(image?.scale)
    hasher.combine(markerColor)
    hasher.combine(anchor?.x)
    hasher.combine(anchor?.y)
    hasher.combine(centerOffset?.x)
    hasher.combine(centerOffset?.y)
    hasher.combine(rotation)
    hasher.combine(flat)
    hasher.combine(opacity)
    hasher.combine(zIndex)
  }

  func markersDescriptorFingerprint() -> Int {
    var hasher = Hasher()
    hashDisplayedIdentity(into: &hasher)
    hasher.combine(enteringAnimation?.kind)
    hasher.combine(enteringAnimation?.duration)
    hasher.combine(enteringAnimation?.delay)
    hasher.combine(enteringAnimation?.reduceMotion)
    return hasher.finalize()
  }

  /// Displayed-marker identity. Omits `enteringAnimation`; retained updates skip it.
  func displayedIdentityVersion() -> Int {
    var hasher = Hasher()
    hashDisplayedIdentity(into: &hasher)
    return hasher.finalize()
  }
}

extension Array where Element == MarkerDescriptor {
  func markersFingerprint() -> Int {
    if isEmpty {
      return 0
    }

    var hash = count
    for descriptor in self {
      hash = 31 &* hash &+ descriptor.markersDescriptorFingerprint()
    }
    return hash
  }
}
