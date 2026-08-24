package com.margelo.nitro.nitromaps

internal fun MarkerDescriptor.fingerprint(): Long =
  renderSignature(
    displayedIdentityVersion(),
    enteringAnimation?.kind,
    enteringAnimation?.duration,
    enteringAnimation?.delay,
    enteringAnimation?.reduceMotion,
  )

internal fun Array<MarkerDescriptor>?.markersFingerprint(): Long {
  if (this.isNullOrEmpty()) {
    return 0L
  }

  var hash = size.toLong()
  for (descriptor in this) {
    hash = 31L * hash + descriptor.fingerprint()
  }
  return hash
}
