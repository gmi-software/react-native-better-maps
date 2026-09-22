package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.GoogleMap
import com.margelo.nitro.core.Promise

private const val MAP_RELEASED_MESSAGE = "MapView was released before the native map became available"

/**
 * Runs work that needs the [GoogleMap], holding it back until `getMapAsync`
 * delivers one: an imperative camera call can reach the adapter while there is
 * still no map to drive, and must not quietly do nothing. Every member hops to
 * the main thread, so callers may use it from any thread - which also means
 * work handed to [promise] takes its place in the queue after that hop, not at
 * the call itself.
 */
internal class DeferredGoogleMap {
  private var map: GoogleMap? = null
  private var isReleased = false
  private val waiting = mutableListOf<(Result<GoogleMap>) -> Unit>()

  /**
   * Publishes the map and drains everything waiting for it, in call order.
   *
   * Ignored once [release] has happened: `getMapAsync` can deliver after the
   * adapter destroyed its `MapView`, and that map must not come back to life.
   */
  fun attach(map: GoogleMap) {
    runOnMain {
      if (isReleased) {
        return@runOnMain
      }

      this.map = map
      drain(Result.success(map))
    }
  }

  /** Drops the map for good and rejects everything waiting for it, now or later. */
  fun release() {
    runOnMain {
      isReleased = true
      map = null
      drain(Result.failure(IllegalStateException(MAP_RELEASED_MESSAGE)))
    }
  }

  /**
   * Resolves with the result of [block], running it as soon as the map exists.
   *
   * Rejects with whatever [block] throws, and with an [IllegalStateException]
   * once [release] has happened - a released map never arrives, so the caller
   * is never left waiting on one.
   */
  fun <T> promise(block: (GoogleMap) -> T): Promise<T> {
    val promise = Promise<T>()

    runOnMain {
      val deliver: (Result<GoogleMap>) -> Unit = { result ->
        result
          .mapCatching(block)
          .onSuccess { value -> promise.resolve(value) }
          .onFailure { error -> promise.reject(error) }
      }

      val currentMap = map
      when {
        currentMap != null -> deliver(Result.success(currentMap))
        isReleased -> deliver(Result.failure(IllegalStateException(MAP_RELEASED_MESSAGE)))
        else -> waiting += deliver
      }
    }

    return promise
  }

  private fun drain(result: Result<GoogleMap>) {
    val queued = waiting.toList()
    waiting.clear()
    for (deliver in queued) {
      deliver(result)
    }
  }
}
