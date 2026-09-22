package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteMarkerUriPolicyTest {
  @Test
  fun treatsOnlyHttpUrisAsRemote() {
    assertTrue(RemoteMarkerUriPolicy.isRemoteUri("http://example.com/pin.png"))
    assertTrue(RemoteMarkerUriPolicy.isRemoteUri("HTTPS://example.com/pin.png"))
    assertFalse(RemoteMarkerUriPolicy.isRemoteUri("file:///data/pin.png"))
    assertFalse(RemoteMarkerUriPolicy.isRemoteUri("pin"))
    assertFalse(RemoteMarkerUriPolicy.isRemoteUri("asset:/pin.png"))
  }

  @Test
  fun rejectsPrivateAddressesTheDeveloperMachineCouldBeReachedAt() {
    // Every Android development setup lands on one of these: the emulator host alias,
    // a device over `adb reverse`, and a device on the same Wi-Fi.
    assertEquals(
      "host not allowlisted",
      rejectReason("http://10.0.2.2:8095/assets/pin.png"),
    )
    assertEquals(
      "host not allowlisted",
      rejectReason("http://127.0.0.1:8081/assets/pin.png"),
    )
    assertEquals(
      "host not allowlisted",
      rejectReason("http://192.168.1.14:8081/assets/pin.png"),
    )
  }

  @Test
  fun rejectsLinkLocalAndMetadataEndpoints() {
    assertEquals(
      "host not allowlisted",
      rejectReason("http://169.254.169.254/latest/meta-data/"),
    )
    assertEquals(
      "host not allowlisted",
      rejectReason("http://metadata.google.internal/computeMetadata/v1/"),
    )
    assertEquals("host not allowlisted", rejectReason("http://localhost/pin.png"))
    assertEquals("host not allowlisted", rejectReason("http://printer.local/pin.png"))
  }

  @Test
  fun rejectsMalformedAndCredentialBearingUris() {
    assertEquals("unsupported scheme", rejectReason("ftp://example.com/pin.png"))
    assertEquals("missing scheme", rejectReason("//example.com/pin.png"))
    assertEquals("missing host", rejectReason("http:///pin.png"))
    assertEquals(
      "user info not allowed",
      rejectReason("https://user:secret@example.com/pin.png"),
    )
  }

  @Test
  fun allowsAPublicHost() {
    assertNull(rejectReason("https://cdn.example.com/pin.png"))
  }

  @Test
  fun skipsTheHostPolicyForABundledImage() {
    // The packager URL a development build resolves `require('./pin.png')` to; the origin
    // stamp is the only thing keeping it out of the rejections above.
    assertNull(
      rejectReason(
        "http://10.0.2.2:8095/assets/?unstable_path=./assets/pin.png",
        origin = MarkerImageOrigin.BUNDLED,
      ),
    )
  }

  @Test
  fun appliesTheHostPolicyToAnExplicitlyRemoteImage() {
    assertEquals(
      "host not allowlisted",
      rejectReason("http://10.0.2.2:8095/pin.png", origin = MarkerImageOrigin.REMOTE),
    )
  }

  /**
   * Runs the main-thread pre-check, which classifies a numeric host literal without a DNS
   * lookup — so every assertion here stays off the network.
   */
  private fun rejectReason(
    uri: String,
    origin: MarkerImageOrigin? = null,
  ): String? =
    RemoteMarkerUriPolicy.rejectReason(
      image =
        MarkerImage(
          uri = uri,
          width = null,
          height = null,
          scale = null,
          origin = origin,
        ),
      resolveHostAddress = false,
    )
}
