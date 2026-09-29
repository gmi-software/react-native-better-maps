package com.margelo.nitro.nitromaps

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/** Shares native marker positions with Fabric measurement without a JS update. */
@Keep
@DoNotStrip
object MarkerProjectionRegistry {
  @JvmStatic external fun publish(tag: Int, x: Float, y: Float)
  @JvmStatic external fun clear(tag: Int)
}
