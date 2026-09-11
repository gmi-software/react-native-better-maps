package com.margelo.nitro.nitromaps

import android.animation.ValueAnimator
import android.os.Build

internal enum class ResolvedOverlayEnteringAnimationKind {
  NONE,
  SYSTEM,
  FADE,
}

internal data class ResolvedOverlayEnteringAnimation(
  val kind: ResolvedOverlayEnteringAnimationKind,
  val durationMs: Long,
  val delayMs: Long,
  val reduceMotion: OverlayEnteringAnimationReduceMotion,
)

internal object OverlayEnteringAnimationResolver {
  fun resolve(
    animation: OverlayEnteringAnimationDescriptor?,
    fallback: OverlayEnteringAnimationDescriptor? = null,
  ): ResolvedOverlayEnteringAnimation {
    val descriptor = animation ?: fallback
    val kind =
      when (descriptor?.kind) {
        OverlayEnteringAnimationKind.NONE -> ResolvedOverlayEnteringAnimationKind.NONE

        OverlayEnteringAnimationKind.FADE -> ResolvedOverlayEnteringAnimationKind.FADE

        OverlayEnteringAnimationKind.FADE_SCALE -> ResolvedOverlayEnteringAnimationKind.FADE

        OverlayEnteringAnimationKind.SYSTEM,
        null,
        -> ResolvedOverlayEnteringAnimationKind.SYSTEM
      }

    return ResolvedOverlayEnteringAnimation(
      kind = kind,
      durationMs = milliseconds(descriptor?.duration, DEFAULT_DURATION_MS),
      delayMs = milliseconds(descriptor?.delay, 0),
      reduceMotion = descriptor?.reduceMotion ?: OverlayEnteringAnimationReduceMotion.SYSTEM,
    )
  }

  fun shouldRun(animation: ResolvedOverlayEnteringAnimation): Boolean {
    if (
      animation.kind == ResolvedOverlayEnteringAnimationKind.NONE ||
      animation.kind == ResolvedOverlayEnteringAnimationKind.SYSTEM
    ) {
      return false
    }
    if (
      animation.reduceMotion == OverlayEnteringAnimationReduceMotion.SYSTEM &&
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !ValueAnimator.areAnimatorsEnabled()
    ) {
      return false
    }
    return animation.durationMs > 0
  }

  private fun milliseconds(
    value: Double?,
    fallback: Long,
  ): Long {
    if (value == null || !value.isFinite()) {
      return fallback
    }
    return value.coerceIn(0.0, 3000.0).toLong()
  }

  private const val DEFAULT_DURATION_MS = 180L
}
