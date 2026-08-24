package com.margelo.nitro.nitromaps

/**
 * Absent values hash outside the `Int` range so no present value can collide with them.
 * Without this, `null` and `0.0` are indistinguishable, because `0.0.hashCode() == 0`.
 */
private const val ABSENT_HASH = 0x1_0000_0000L

/** Stable fold over the given parts, used to version render state for diffing. */
internal fun renderSignature(vararg parts: Any?): Long {
  var hash = -3750763034362895579L
  for (part in parts) {
    hash = 1099511628211L * hash + (part?.hashCode()?.toLong() ?: ABSENT_HASH)
  }
  return hash
}
