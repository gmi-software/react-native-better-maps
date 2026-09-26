package com.margelo.nitro.nitromaps

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL

class RemoteMarkerImageFetcherTest {
  private val pin = byteArrayOf(1, 2, 3)
  private val responses = mutableMapOf<String, FakeConnection>()
  private val opened = mutableListOf<String>()
  private val rejections = mutableListOf<Pair<String, String>>()

  private val fetcher =
    RemoteMarkerImageFetcher(
      // The real policy, over a DNS that answers without the network.
      hostRejectReason = { uri ->
        RemoteMarkerUriPolicy.rejectReason(uri, resolveHostAddress = true, resolveHost = ::fakeDns)
      },
      openConnection = { url ->
        opened += url.toString()
        responses.getValue(url.toString())
      },
    )

  @Test
  fun refusesARedirectFromAPublicHostToAPrivateOne() {
    redirect("http://cdn.example.com/pin.png", to = "http://192.168.1.1/admin/pin.png")

    assertNull(fetch("http://cdn.example.com/pin.png"))
    assertEquals(listOf("http://192.168.1.1/admin/pin.png" to "host not allowlisted"), rejections)
    assertEquals(listOf("http://cdn.example.com/pin.png"), opened)
  }

  @Test
  fun refusesARedirectToAHostNameThatResolvesToAPrivateAddress() {
    redirect("https://cdn.example.com/pin.png", to = "https://rebind.example.com/pin.png")

    assertNull(fetch("https://cdn.example.com/pin.png"))
    assertEquals(listOf("https://rebind.example.com/pin.png" to "host not allowlisted"), rejections)
    assertEquals(listOf("https://cdn.example.com/pin.png"), opened)
  }

  @Test
  fun followsRedirectsBetweenPublicHosts() {
    redirect("http://cdn.example.com/pin.png", to = "https://img.example.com/pin.png", status = 301)
    serve("https://img.example.com/pin.png")

    assertArrayEquals(pin, fetch("http://cdn.example.com/pin.png"))
    assertEquals(emptyList<Pair<String, String>>(), rejections)
    assertFalse(responses.getValue("http://cdn.example.com/pin.png").instanceFollowRedirects)
  }

  @Test
  fun resolvesARelativeLocationAgainstTheRedirectingUrl() {
    redirect("https://cdn.example.com/v1/pin.png", to = "../v2/pin.png")
    serve("https://cdn.example.com/v2/pin.png")

    assertArrayEquals(pin, fetch("https://cdn.example.com/v1/pin.png"))
  }

  @Test
  fun refusesARedirectFromHttpsToHttp() {
    redirect("https://cdn.example.com/pin.png", to = "http://cdn.example.com/pin.png")

    assertNull(fetch("https://cdn.example.com/pin.png"))
    assertEquals(listOf("http://cdn.example.com/pin.png" to "redirect from https to http"), rejections)
  }

  @Test
  fun refusesARedirectWithoutALocation() {
    redirect("https://cdn.example.com/pin.png", to = null)

    assertNull(fetch("https://cdn.example.com/pin.png"))
    assertEquals(
      listOf("https://cdn.example.com/pin.png" to "redirect without a usable location"),
      rejections,
    )
  }

  @Test
  fun givesUpAfterTooManyRedirects() {
    val hops = (0..RemoteMarkerImageFetcher.MAX_REDIRECTS + 1).map { "https://cdn.example.com/$it.png" }
    hops.zipWithNext().forEach { (from, to) -> redirect(from, to) }

    assertNull(fetch(hops.first()))
    assertEquals(RemoteMarkerImageFetcher.MAX_REDIRECTS + 1, opened.size)
    assertEquals(
      listOf(hops.first() to "more than ${RemoteMarkerImageFetcher.MAX_REDIRECTS} redirects"),
      rejections,
    )
  }

  @Test
  fun fetchesABundledImageFromThePackagerWithoutTheHostPolicy() {
    serve("http://10.0.2.2:8081/assets/pin.png")

    assertArrayEquals(pin, fetch("http://10.0.2.2:8081/assets/pin.png", MarkerImageOrigin.BUNDLED))
    assertEquals(emptyList<Pair<String, String>>(), rejections)
  }

  @Test
  fun keepsTheRedirectOfABundledImageOnHttp() {
    redirect("http://10.0.2.2:8081/assets/pin.png", to = "file:///sdcard/pin.png")

    assertNull(fetch("http://10.0.2.2:8081/assets/pin.png", MarkerImageOrigin.BUNDLED))
    assertEquals(listOf("file:/sdcard/pin.png" to "redirect to an unsupported scheme"), rejections)
  }

  private fun fetch(
    uri: String,
    origin: MarkerImageOrigin? = null,
  ): ByteArray? =
    fetcher.fetch(
      MarkerImage(uri = uri, width = null, height = null, scale = null, origin = origin),
    ) { rejectedUri, reason -> rejections += rejectedUri to reason }

  private fun serve(uri: String) {
    responses[uri] = FakeConnection(URL(uri), status = 200, body = pin)
  }

  private fun redirect(
    uri: String,
    to: String?,
    status: Int = 302,
  ) {
    responses[uri] = FakeConnection(URL(uri), status = status, location = to)
  }

  /** Answers from [zone] for a host name, and parses an IP literal as the real lookup does. */
  private fun fakeDns(host: String): Array<InetAddress> {
    zone[host]?.let { return it }
    check(host.all { it.isDigit() || it == '.' }) { "no fake DNS answer for $host" }
    return InetAddress.getAllByName(host)
  }

  private val zone =
    mapOf(
      "cdn.example.com" to arrayOf(PUBLIC_ADDRESS),
      "img.example.com" to arrayOf(PUBLIC_ADDRESS),
      // A public answer next to a private one, as a rebinding DNS server would give.
      "rebind.example.com" to arrayOf(PUBLIC_ADDRESS, InetAddress.getByAddress(byteArrayOf(10, 0, 0, 1))),
    )

  private class FakeConnection(
    url: URL,
    private val status: Int,
    private val location: String? = null,
    private val body: ByteArray = ByteArray(0),
  ) : HttpURLConnection(url) {
    override fun connect() = Unit

    override fun disconnect() = Unit

    override fun usingProxy() = false

    override fun getResponseCode() = status

    override fun getHeaderField(name: String?): String? = if (name.equals("Location", ignoreCase = true)) location else null

    override fun getInputStream(): InputStream = ByteArrayInputStream(body)
  }

  private companion object {
    val PUBLIC_ADDRESS: InetAddress = InetAddress.getByAddress(byteArrayOf(93, 184.toByte(), 216.toByte(), 34))
  }
}
