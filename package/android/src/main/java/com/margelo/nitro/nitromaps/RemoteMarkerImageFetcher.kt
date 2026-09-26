package com.margelo.nitro.nitromaps

import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL

/**
 * Downloads a remote marker image and follows its redirects itself, so that every hop of a
 * user-supplied URL passes [RemoteMarkerUriPolicy]. `HttpURLConnection` would otherwise follow a
 * public URL's redirect to a private host without asking the policy.
 *
 * @param hostRejectReason the policy check for one hop; a seam for tests.
 * @param openConnection opens one hop; a seam for tests.
 */
internal class RemoteMarkerImageFetcher(
  private val hostRejectReason: (uri: String) -> String? = { uri ->
    RemoteMarkerUriPolicy.rejectReason(uri, resolveHostAddress = true)
  },
  private val openConnection: (URL) -> HttpURLConnection = { url ->
    url.openConnection() as HttpURLConnection
  },
) {
  /**
   * Returns the body at [image]'s URL, or `null` after telling [onRejected] which URI may not be
   * fetched and why. A failed request throws.
   */
  fun fetch(
    image: MarkerImage,
    onRejected: (uri: String, reason: String) -> Unit,
  ): ByteArray? {
    // Like the policy itself, a bundled image skips the host check, on every hop.
    val checksHost = image.origin != MarkerImageOrigin.BUNDLED
    var url = URL(image.uri)

    repeat(MAX_REDIRECTS + 1) {
      if (checksHost) {
        // The URL about to be opened, as it will be opened, rather than the string it came from.
        hostRejectReason(url.toString())?.let { reason ->
          onRejected(url.toString(), reason)
          return null
        }
      }

      val connection = openConnection(url)
      connection.instanceFollowRedirects = false
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      if (connection.responseCode !in REDIRECT_STATUS_CODES) {
        return connection.inputStream.use { it.readBytes() }
      }

      val location = connection.getHeaderField("Location")
      connection.disconnect()
      val target = location?.let { resolveLocation(url, it) }
      if (target == null) {
        onRejected(url.toString(), "redirect without a usable location")
        return null
      }
      RemoteMarkerUriPolicy.redirectRejectReason(url, target)?.let { reason ->
        onRejected(target.toString(), reason)
        return null
      }
      url = target
    }

    onRejected(image.uri, "more than $MAX_REDIRECTS redirects")
    return null
  }

  private fun resolveLocation(
    from: URL,
    location: String,
  ): URL? =
    try {
      // Unlike `URI.resolve`, keeps the slash when `from` has an empty path.
      URL(from, location)
    } catch (_: MalformedURLException) {
      null
    }

  companion object {
    const val MAX_REDIRECTS = 5
    private const val TIMEOUT_MS = 10_000

    /** The redirect statuses Android's `HttpURLConnection` follows on its own. */
    private val REDIRECT_STATUS_CODES = setOf(300, 301, 302, 303, 307, 308)
  }
}
