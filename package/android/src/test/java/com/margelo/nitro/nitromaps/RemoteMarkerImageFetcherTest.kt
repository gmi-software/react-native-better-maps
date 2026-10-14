package com.margelo.nitro.nitromaps

import okhttp3.Dns
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import javax.net.SocketFactory
import kotlin.concurrent.thread

/**
 * Runs the fetcher against a local HTTP server. Every connection lands on that server whatever
 * address the client connects to, so no host name below reaches the network, while the client
 * still believes it is connected to the address its DNS answered.
 */
class RemoteMarkerImageFetcherTest {
  private val server = FakeHttpServer()
  private val port = server.port
  private val rejections = mutableListOf<Pair<String, String>>()

  /** What the policy's lookup, before each request, answers. */
  private val checkedZone =
    mapOf(
      "cdn.example.com" to PUBLIC_ADDRESS,
      "img.example.com" to PUBLIC_ADDRESS,
      "rebind.example.com" to PUBLIC_ADDRESS,
    )

  /** What the client's own lookup, when it connects, answers. */
  private val connectedZone =
    mapOf(
      "cdn.example.com" to PUBLIC_ADDRESS,
      "img.example.com" to PUBLIC_ADDRESS,
      // Rebinding: public when the policy looked, private once the client connects.
      "rebind.example.com" to PRIVATE_ADDRESS,
    )

  private val fetcher =
    RemoteMarkerImageFetcher(
      baseClient =
        OkHttpClient
          .Builder()
          .dns(
            object : Dns {
              override fun lookup(hostname: String) = lookUp(connectedZone, hostname)
            },
          ).socketFactory(server.socketFactory)
          .proxy(Proxy.NO_PROXY)
          .build(),
      hostRejectReason = { uri ->
        RemoteMarkerUriPolicy.rejectReason(uri, resolveHostAddress = true) { host ->
          lookUp(checkedZone, host).toTypedArray()
        }
      },
    )

  @After
  fun closeServer() {
    server.close()
  }

  @Test
  fun fetchesAPublicImage() {
    server.respond("cdn.example.com:$port/pin.png", ok("pin"))

    assertArrayEquals("pin".toByteArray(), fetch("http://cdn.example.com:$port/pin.png"))
    assertEquals(listOf("cdn.example.com:$port/pin.png"), server.requests)
    assertEquals(emptyList<Pair<String, String>>(), rejections)
  }

  @Test
  fun sendsNothingToAPrivateAddressAHostRebindsToAfterTheCheck() {
    server.respond("rebind.example.com:$port/pin.png", ok("pin"))

    assertNull(fetch("http://rebind.example.com:$port/pin.png"))
    assertEquals(
      listOf("http://rebind.example.com:$port/pin.png" to "connected address not allowlisted"),
      rejections,
    )
    // The client did connect, but closed the connection without writing the request to it.
    server.awaitConnections(1)
    assertEquals(emptyList<String>(), server.requests)
  }

  @Test
  fun refusesARedirectFromAPublicHostToAPrivateOne() {
    server.respond("cdn.example.com:$port/pin.png", redirect("http://192.168.1.1:$port/admin/pin.png"))

    assertNull(fetch("http://cdn.example.com:$port/pin.png"))
    assertEquals(listOf("http://192.168.1.1:$port/admin/pin.png" to "host not allowlisted"), rejections)
    assertEquals(listOf("cdn.example.com:$port/pin.png"), server.requests)
  }

  @Test
  fun refusesARedirectToAHostThatRebindsToAPrivateAddress() {
    server.respond("cdn.example.com:$port/pin.png", redirect("http://rebind.example.com:$port/pin.png"))
    server.respond("rebind.example.com:$port/pin.png", ok("pin"))

    assertNull(fetch("http://cdn.example.com:$port/pin.png"))
    assertEquals(
      listOf("http://rebind.example.com:$port/pin.png" to "connected address not allowlisted"),
      rejections,
    )
    server.awaitConnections(2)
    assertEquals(listOf("cdn.example.com:$port/pin.png"), server.requests)
  }

  @Test
  fun followsRedirectsBetweenPublicHosts() {
    server.respond("cdn.example.com:$port/pin.png", redirect("http://img.example.com:$port/pin.png", status = 301))
    server.respond("img.example.com:$port/pin.png", ok("pin"))

    assertArrayEquals("pin".toByteArray(), fetch("http://cdn.example.com:$port/pin.png"))
    assertEquals(listOf("cdn.example.com:$port/pin.png", "img.example.com:$port/pin.png"), server.requests)
  }

  @Test
  fun resolvesARelativeLocationAgainstTheRedirectingUrl() {
    server.respond("cdn.example.com:$port/v1/pin.png", redirect("../v2/pin.png"))
    server.respond("cdn.example.com:$port/v2/pin.png", ok("pin"))

    assertArrayEquals("pin".toByteArray(), fetch("http://cdn.example.com:$port/v1/pin.png"))
  }

  @Test
  fun refusesARedirectWithoutALocation() {
    server.respond("cdn.example.com:$port/pin.png", redirect(location = null))

    assertNull(fetch("http://cdn.example.com:$port/pin.png"))
    assertEquals(
      listOf("http://cdn.example.com:$port/pin.png" to "redirect without a usable location"),
      rejections,
    )
  }

  @Test
  fun givesUpAfterTooManyRedirects() {
    val hops = (0..RemoteMarkerImageFetcher.MAX_REDIRECTS + 1).map { "/$it.png" }
    hops.zipWithNext().forEach { (from, to) -> server.respond("cdn.example.com:$port$from", redirect(to)) }

    assertNull(fetch("http://cdn.example.com:$port${hops.first()}"))
    assertEquals(RemoteMarkerImageFetcher.MAX_REDIRECTS + 1, server.requests.size)
    assertEquals(
      listOf("http://cdn.example.com:$port${hops.first()}" to "more than ${RemoteMarkerImageFetcher.MAX_REDIRECTS} redirects"),
      rejections,
    )
  }

  @Test
  fun throwsForAnHttpError() {
    assertThrows(IOException::class.java) { fetch("http://cdn.example.com:$port/missing.png") }
  }

  @Test
  fun fetchesABundledImageFromThePackagerWithoutEitherCheck() {
    server.respond("10.0.2.2:$port/assets/pin.png", ok("pin"))

    assertArrayEquals("pin".toByteArray(), fetch("http://10.0.2.2:$port/assets/pin.png", MarkerImageOrigin.BUNDLED))
    assertEquals(emptyList<Pair<String, String>>(), rejections)
  }

  @Test
  fun keepsTheRedirectOfABundledImageOnHttp() {
    server.respond("10.0.2.2:$port/assets/pin.png", redirect("file:///sdcard/pin.png"))

    assertNull(fetch("http://10.0.2.2:$port/assets/pin.png", MarkerImageOrigin.BUNDLED))
    assertEquals(listOf("file:/sdcard/pin.png" to "redirect to an unsupported scheme"), rejections)
  }

  private fun fetch(
    uri: String,
    origin: MarkerImageOrigin? = null,
  ): ByteArray? =
    fetcher.fetch(
      MarkerImage(uri = uri, width = null, height = null, scale = null, origin = origin),
    ) { rejectedUri, reason -> rejections += rejectedUri to reason }

  /** Answers from [zone] for a host name, and parses an IP literal as a real lookup does. */
  private fun lookUp(
    zone: Map<String, InetAddress>,
    host: String,
  ): List<InetAddress> {
    zone[host]?.let { return listOf(it) }
    check(host.all { it.isDigit() || it == '.' }) { "no fake DNS answer for $host" }
    return InetAddress.getAllByName(host).toList()
  }

  private fun ok(body: String) = "HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n$body"

  private fun redirect(
    location: String?,
    status: Int = 302,
  ) = "HTTP/1.1 $status Redirect\r\n${location?.let { "Location: $it\r\n" } ?: ""}Content-Length: 0\r\nConnection: close\r\n\r\n"

  /**
   * Answers each request with the response registered for its `Host` and path, and records the
   * requests it receives. A connection that carries no request records nothing.
   */
  private class FakeHttpServer : AutoCloseable {
    private val serverSocket = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
    private val responses = ConcurrentHashMap<String, String>()
    private val handlers = CopyOnWriteArrayList<Thread>()
    val requests = CopyOnWriteArrayList<String>()
    val port = serverSocket.localPort

    /** Connects every socket to this server, whatever address it is asked to connect to. */
    val socketFactory =
      object : SocketFactory() {
        override fun createSocket(): Socket =
          object : Socket() {
            override fun connect(
              endpoint: SocketAddress?,
              timeout: Int,
            ) = super.connect(InetSocketAddress(InetAddress.getLoopbackAddress(), this@FakeHttpServer.port), timeout)
          }

        override fun createSocket(
          host: String?,
          port: Int,
        ): Socket = throw UnsupportedOperationException()

        override fun createSocket(
          host: String?,
          port: Int,
          localHost: InetAddress?,
          localPort: Int,
        ): Socket = throw UnsupportedOperationException()

        override fun createSocket(
          host: InetAddress?,
          port: Int,
        ): Socket = throw UnsupportedOperationException()

        override fun createSocket(
          address: InetAddress?,
          port: Int,
          localAddress: InetAddress?,
          localPort: Int,
        ): Socket = throw UnsupportedOperationException()
      }

    private val acceptor =
      thread(isDaemon = true) {
        while (true) {
          val socket =
            try {
              serverSocket.accept()
            } catch (_: IOException) {
              break
            }
          handlers += thread(isDaemon = true) { socket.use(::answer) }
        }
      }

    fun respond(
      hostAndPath: String,
      response: String,
    ) {
      responses[hostAndPath] = response
    }

    /** Waits until [count] connections were accepted and each was answered or dropped. */
    fun awaitConnections(count: Int) {
      val deadline = System.nanoTime() + 5_000_000_000L
      while (handlers.size < count && System.nanoTime() < deadline) {
        Thread.sleep(10)
      }
      handlers.forEach { it.join(5_000) }
    }

    override fun close() {
      serverSocket.close()
      acceptor.join(5_000)
    }

    private fun answer(socket: Socket) {
      val reader = socket.getInputStream().bufferedReader(Charsets.ISO_8859_1)
      val requestLine = reader.readLine() ?: return
      val headers = generateSequence { reader.readLine()?.takeIf { it.isNotEmpty() } }.toList()
      val host = headers.first { it.startsWith("Host:", ignoreCase = true) }.substringAfter(':').trim()
      val target = host + requestLine.split(' ')[1]
      requests += target
      val response = responses[target] ?: "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
      socket.getOutputStream().apply {
        write(response.toByteArray(Charsets.ISO_8859_1))
        flush()
      }
    }
  }

  private companion object {
    val PUBLIC_ADDRESS: InetAddress = InetAddress.getByAddress(byteArrayOf(93, 184.toByte(), 216.toByte(), 34))
    val PRIVATE_ADDRESS: InetAddress = InetAddress.getByAddress(byteArrayOf(10, 0, 0, 1))
  }
}
