package com.margelo.nitro.nitromaps

/**
 * Holds a map view's provider adapter and builds a new one only when the configuration it is
 * built from has changed. [HybridMapView] commits to it once per prop transaction.
 *
 * `ProviderAdapterSlot.swift` is the iOS counterpart; change the two together.
 */
internal class ProviderAdapterSlot<Configuration : Any, Adapter : Any>(
  private val build: (Configuration) -> Adapter,
  private val destroy: (Adapter) -> Unit,
) {
  /** Written on the main thread, read from the JS thread by the imperative methods. */
  @Volatile
  var adapter: Adapter? = null
    private set

  private var builtFrom: Configuration? = null

  /**
   * Makes [adapter] one built from [configuration]: returns it when it had to be built, and null
   * when the current one already was. The current adapter is destroyed before the next one is
   * built, so there are never two at once; a [build] that throws leaves none.
   */
  fun commit(configuration: Configuration): Adapter? {
    if (adapter != null && configuration == builtFrom) {
      return null
    }

    release()
    val next = build(configuration)
    adapter = next
    builtFrom = configuration
    return next
  }

  /** Destroys the adapter, if there is one; the next [commit] builds a new one regardless. */
  fun release() {
    val current = adapter ?: return
    adapter = null
    builtFrom = null
    destroy(current)
  }
}
