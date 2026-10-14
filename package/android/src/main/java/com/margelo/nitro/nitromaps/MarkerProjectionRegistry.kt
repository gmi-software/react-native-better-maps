package com.margelo.nitro.nitromaps

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/**
 * Shares where each live marker host is translated to with Fabric's shadow nodes, without a JS
 * update. Backed by `cpp/MarkerProjectionRegistry`; values are in dp, keyed by Fabric tag.
 */
@Keep
@DoNotStrip
internal object MarkerProjectionRegistry {
  @JvmStatic external fun publish(
    tag: Int,
    x: Float,
    y: Float,
  )

  @JvmStatic external fun clear(tag: Int)
}
