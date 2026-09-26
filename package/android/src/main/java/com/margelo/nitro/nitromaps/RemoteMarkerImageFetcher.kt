package com.margelo.nitro.nitromaps

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException
import java.net.MalformedURLException
import java.net.Proxy
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Downloads a remote marker image and follows its redirects itself, so that every hop of a
 * user-supplied URL passes [RemoteMarkerUriPolicy]. An automatic redirect would reach a private
 * host without asking the policy.
 *
 * Each hop is checked twice. First the URL, before the request: that gives a reason to log, and
 * in the common case no connection is made at all. Then the address the connection was actually
 * made to, before anything is sent over it ([ConnectedAddressCheck]). The client resolves the host
 * again to connect, and a DNS answer that changed in between (rebinding) would otherwise send the
 * request to a private address the first check never saw.
 *
 * @param baseClient the client the fetching clients are derived from; a seam for tests.
 * @param hostRejectReason the policy check on one hop's URL; a seam for tests.
 */
internal class RemoteMarkerImageFetcher(
  baseClient: OkHttpClient = OkHttpClient(),
  private val hostRejectReason: (uri: String) -> String? = { uri ->
    RemoteMarkerUriPolicy.rejectReason(uri, resolveHostAddress = true)
  },
) {
  /** Fetches a `require()`d image, whose packager URL is private in a development build. */
  private val bundledClient =
    baseClient
      .newBuilder()
      .followRedirects(false)
      .followSslRedirects(false)
      .connectTimeout(TIMEOUT_MS, TimeUnit.MILLISECONDS)
      .readTimeout(TIMEOUT_MS, TimeUnit.MILLISECONDS)
      .build()

  /** Fetches a user-supplied image, and only over a connection the policy allows. */
  private val userClient = bundledClient.newBuilder().addNetworkInterceptor(ConnectedAddressCheck).build()

  /**
   * Returns the body at [image]'s URL, or `null` after telling [onRejected] which URI may not be
   * fetched and why. A failed request throws.
   */
  fun fetch(
    image: MarkerImage,
    onRejected: (uri: String, reason: String) -> Unit,
  ): ByteArray? {
    // Like the policy itself, a bundled image skips the host checks, on every hop.
    val checksHost = image.origin != MarkerImageOrigin.BUNDLED
    val client = if (checksHost) userClient else bundledClient
    var url = URL(image.uri)

    repeat(MAX_REDIRECTS + 1) {
      if (checksHost) {
        // The URL about to be requested, as it will be requested, rather than the string it came from.
        hostRejectReason(url.toString())?.let { reason ->
          onRejected(url.toString(), reason)
          return null
        }
      }

      val response =
        try {
          client.newCall(Request.Builder().url(url).build()).execute()
        } catch (rejected: RejectedConnectionException) {
          onRejected(url.toString(), rejected.reason)
          return null
        }

      response.use {
        if (!response.isRedirect) {
          if (!response.isSuccessful) {
            throw IOException("HTTP ${response.code} for $url")
          }
          return response.body?.bytes()
        }

        val target = response.header("Location")?.let { resolveLocation(url, it) }
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

  /**
   * Closes a direct connection to an address [RemoteMarkerUriPolicy] rejects before the request is
   * written to it. Behind a proxy, the proxy resolves the host, so only the check on the URL applies.
   */
  private object ConnectedAddressCheck : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
      val connection = chain.connection()
      if (connection != null && connection.route().proxy.type() == Proxy.Type.DIRECT) {
        val address = connection.route().socketAddress.address
        if (address == null || !RemoteMarkerUriPolicy.isAllowlistedAddress(address)) {
          connection.socket().close()
          throw RejectedConnectionException("connected address not allowlisted")
        }
      }
      return chain.proceed(chain.request())
    }
  }

  /** A connection the policy refused before anything was sent over it. */
  private class RejectedConnectionException(
    val reason: String,
  ) : IOException(reason)

  companion object {
    const val MAX_REDIRECTS = 5
    private const val TIMEOUT_MS = 10_000L
  }
}
