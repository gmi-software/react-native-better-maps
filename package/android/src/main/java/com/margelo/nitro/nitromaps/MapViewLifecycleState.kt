package com.margelo.nitro.nitromaps

/**
 * Ordered lifecycle states a Google `MapView` can be driven through. [CREATED],
 * [STARTED] and [RESUMED] are reversible; [DESTROYED] is terminal.
 */
internal enum class MapViewLifecycleState {
  CREATED,
  STARTED,
  RESUMED,
  DESTROYED,
}
