package com.margelo.nitro.nitromaps

/**
 * Turns the Google Maps camera callbacks into one `onRegionChange` /
 * `onRegionChangeComplete` pair per move of the camera.
 *
 * The SDK is noisier than that. It reports a move starting again whenever the
 * reason for it changes, and it reports a start and an idle for a camera update
 * that leaves the camera exactly where it was - a repeated fit, or a `region`
 * prop sent again with the same values, which an inline object literal does on
 * every render. So a move is announced only once the camera has left the place
 * it last came to rest, and a move that never did announces nothing. Otherwise a
 * handler that re-renders the map would be answered by a move that re-renders it
 * again, for ever. Until the camera has come to rest once there is nothing to
 * measure against - the map is still settling into its first position - so that
 * is not announced either.
 *
 * `package/ios/Camera/RegionChangeTracker.swift` is the same class for the iOS
 * adapters. Main thread only, like the map callbacks that drive it.
 */
internal class RegionChangeTracker<Position>(
  private val position: () -> Position,
  private val region: () -> Region,
  private val onBegin: (Region, RegionChangeDetails) -> Unit,
  private val onComplete: (Region, RegionChangeDetails) -> Unit,
) {
  private class Move<Position>(
    val details: RegionChangeDetails,
    /** `null` while the map is still settling into its first position. */
    val start: Resting<Position>?,
  ) {
    var hasBegun = false
  }

  private class Resting<Position>(
    val position: Position,
    val region: Region,
  )

  private var move: Move<Position>? = null
  private var rest: Resting<Position>? = null

  /** True while the finger, rather than the app, is driving the camera. */
  val isGesture: Boolean
    get() = move?.details?.isGesture == true

  /** The SDK says the camera is about to move: `onCameraMoveStarted`. */
  fun moveStarted(isGesture: Boolean) {
    val current = move
    if (current == null) {
      move = Move(RegionChangeDetails(isGesture = isGesture), rest)
      return
    }

    // Still the same move - unless a gesture takes over from the app's own, which
    // ends the app's move where the finger caught the camera and starts the user's there.
    if (!isGesture || current.details.isGesture) {
      return
    }

    finish(current)
    move = Move(RegionChangeDetails(isGesture = true), Resting(position(), region()))
  }

  /** The SDK says the camera has moved on a step: `onCameraMove`. */
  fun cameraMoved() {
    move?.let(::beginIfMoved)
  }

  /** The SDK says the camera has come to rest: `onCameraIdle`. */
  fun cameraStopped() {
    move?.let(::finish)
    rest = Resting(position(), region())
  }

  private fun finish(current: Move<Position>) {
    move = null
    // A jump can come to rest without a single step reported in between.
    beginIfMoved(current)
    if (current.hasBegun) {
      onComplete(region(), current.details)
    }
  }

  private fun beginIfMoved(current: Move<Position>) {
    val start = current.start ?: return
    if (current.hasBegun || position() == start.position) {
      return
    }

    current.hasBegun = true
    onBegin(start.region, current.details)
  }
}
