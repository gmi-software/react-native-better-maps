package com.margelo.nitro.nitromaps

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

@Keep
@DoNotStrip
class HybridMarkerView(context: ThemedReactContext) : HybridMarkerViewSpec() {
  override val view = NitroMarkerContentView(context)

  override var coordinate = Coordinate(0.0, 0.0)
    set(value) { field = value; view.coordinate = value }

  override var anchor: MarkerAnchor? = null
    set(value) { field = value; view.anchor = value }

  override fun afterUpdate() { view.updatePosition() }
}
