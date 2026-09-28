package com.margelo.nitro.nitromaps

import java.net.Inet6Address
import java.net.InetAddress
import java.net.URI
import java.net.URISyntaxException
import java.net.URL
import java.net.UnknownHostException
import java.util.Locale

/**
 * Decides whether a marker image may be fetched over the network.
 *
 * The policy exists for URLs that arrive as *data* — `image={{ uri: apiResponse.iconUrl }}`
 * pointing at a router admin page or a cloud metadata endpoint — so it only applies to images the
 * app did not bundle. A `require()`d asset carries [MarkerImageOrigin.BUNDLED] from the JS side and
 * skips the check: a development build resolves it to a Metro packager URL, whose address is always
 * private (`10.0.2.2` on the emulator, `127.0.0.1` over `adb reverse`, `192.168.x.x` over Wi-Fi), so
 * the host cannot tell a bundled asset apart from the addresses this policy blocks.
 */
internal object RemoteMarkerUriPolicy {
  /** Whether [uriString] is fetched over the network rather than read from the app package. */
  fun isRemoteUri(uriString: String): Boolean {
    val scheme = parseUri(uriString)?.scheme?.lowercase(Locale.US) ?: return false
    return scheme == "http" || scheme == "https"
  }

  /**
   * Returns why [image] must not be fetched, or `null` when the fetch is allowed.
   *
   * @param resolveHostAddress whether a host name may be resolved through DNS. `false` for the
   *   pre-check on the main thread, `true` once the caller is on the load executor, so only a
   *   numeric host literal is classified before the thread hop.
   */
  fun rejectReason(
    image: MarkerImage,
    resolveHostAddress: Boolean,
  ): String? {
    if (image.origin == MarkerImageOrigin.BUNDLED) {
      return null
    }

    return rejectReason(image.uri, resolveHostAddress)
  }

  /**
   * The same check for a URI that carries no bundled origin, such as where a user-supplied
   * image redirects to.
   *
   * @param resolveHost looks up every address of a host name; a seam for tests.
   */
  fun rejectReason(
    uriString: String,
    resolveHostAddress: Boolean,
    resolveHost: (String) -> Array<InetAddress> = { host -> InetAddress.getAllByName(host) },
  ): String? {
    val uri = parseUri(uriString) ?: return "invalid URI"

    when (uri.scheme?.lowercase(Locale.US)) {
      "http", "https" -> Unit
      null -> return "missing scheme"
      else -> return "unsupported scheme"
    }

    if (uri.userInfo != null) {
      return "user info not allowed"
    }

    val host = uri.host?.lowercase(Locale.US)?.takeIf { it.isNotEmpty() } ?: return "missing host"
    if (!isAllowlistedHost(host, resolveHostAddress, resolveHost)) {
      return "host not allowlisted"
    }

    return null
  }

  /**
   * Returns why a redirect from [from] to [target] must not be followed, or `null` when it may
   * be. This holds for bundled images too: a redirect stays on `http`/`https`, and never goes from
   * `https` down to `http`, which the platform does not follow either. The host of a user-supplied
   * image's target still has to pass [rejectReason], like any other URI.
   */
  fun redirectRejectReason(
    from: URL,
    target: URL,
  ): String? {
    val scheme = target.protocol.lowercase(Locale.US)
    return when {
      scheme != "http" && scheme != "https" -> "redirect to an unsupported scheme"
      scheme == "http" && from.protocol.equals("https", ignoreCase = true) -> "redirect from https to http"
      else -> null
    }
  }

  private fun parseUri(uriString: String): URI? =
    try {
      URI(uriString)
    } catch (_: URISyntaxException) {
      null
    }

  private fun isAllowlistedHost(
    host: String,
    resolveHostAddress: Boolean,
    resolveHost: (String) -> Array<InetAddress>,
  ): Boolean {
    if (host == "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
      return false
    }
    if (host in BLOCKED_HOSTS) {
      return false
    }

    if (!resolveHostAddress && !isNumericHostLiteral(host)) {
      return true
    }

    val addresses =
      try {
        resolveHost(host)
      } catch (_: UnknownHostException) {
        return !resolveHostAddress
      }

    // Every address, not just the first: the connection moves on to the next one when the first
    // does not answer, so a public address listed ahead of a private one proves nothing.
    return addresses.isNotEmpty() && addresses.all(::isAllowlistedAddress)
  }

  private fun isNumericHostLiteral(host: String): Boolean {
    if (host.startsWith("[") && host.endsWith("]")) {
      return true
    }

    val parts = host.split('.')
    return parts.size == 4 &&
      parts.all { part ->
        val value = part.toIntOrNull() ?: return@all false
        value in 0..255
      }
  }

  /** Whether a connection to [address] may carry a request for a user-supplied image. */
  fun isAllowlistedAddress(address: InetAddress): Boolean {
    if (
      address.isLoopbackAddress ||
      address.isAnyLocalAddress ||
      address.isLinkLocalAddress ||
      address.isSiteLocalAddress ||
      address.isMulticastAddress
    ) {
      return false
    }

    if (address is Inet6Address) {
      val firstOctet = address.address[0].toInt() and 0xff
      if ((firstOctet and 0xfe) == 0xfc) {
        return false
      }
    }

    return true
  }

  private val BLOCKED_HOSTS =
    setOf(
      "metadata.google.internal",
      "metadata.goog",
    )
}
