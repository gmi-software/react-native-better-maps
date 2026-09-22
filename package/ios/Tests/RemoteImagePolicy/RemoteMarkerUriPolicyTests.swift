import Testing

@testable import NitroMapsRemoteImagePolicy

/// Runs the pre-check, which classifies a numeric host literal without a DNS lookup — so every
/// assertion in this file stays off the network.
private func rejectReason(_ uri: String, isBundled: Bool = false) -> String? {
  RemoteMarkerUriPolicy.rejectReason(uri: uri, isBundled: isBundled, resolveHostAddress: false)
}

@Test
func treatsOnlyHttpUrisAsRemote() {
  #expect(RemoteMarkerUriPolicy.isRemoteUri("http://example.com/pin.png"))
  #expect(RemoteMarkerUriPolicy.isRemoteUri("HTTPS://example.com/pin.png"))
  #expect(!RemoteMarkerUriPolicy.isRemoteUri("file:///data/pin.png"))
  #expect(!RemoteMarkerUriPolicy.isRemoteUri("pin"))
  #expect(!RemoteMarkerUriPolicy.isRemoteUri("asset:/pin.png"))
}

@Test
func rejectsPrivateAddressesTheDeveloperMachineCouldBeReachedAt() {
  // Every development setup lands on one of these: the simulator sharing the host's loopback,
  // a device on the same Wi-Fi, and the Android emulator's host alias.
  #expect(rejectReason("http://127.0.0.1:8081/assets/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://192.168.1.14:8081/assets/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://10.0.2.2:8095/assets/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://172.16.0.1/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://0.0.0.0/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://239.1.2.3/pin.png") == "host not allowlisted")
}

@Test
func rejectsLinkLocalAndMetadataEndpoints() {
  #expect(rejectReason("http://169.254.169.254/latest/meta-data/") == "host not allowlisted")
  #expect(
    rejectReason("http://metadata.google.internal/computeMetadata/v1/") == "host not allowlisted")
  #expect(rejectReason("http://localhost/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://printer.local/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://metro.localhost/pin.png") == "host not allowlisted")
}

@Test
func rejectsPrivateIPv6Literals() {
  #expect(rejectReason("http://[::1]:8081/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://[::]/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://[fe80::1]/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://[fec0::1]/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://[fd12:3456::1]/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://[ff02::1]/pin.png") == "host not allowlisted")
}

@Test
func rejectsAPrivateIPv4AddressWearingAnIPv6Shape() {
  // `::ffff:127.0.0.1` matches no IPv6 rule, and every stack routes it to 127.0.0.1.
  #expect(rejectReason("http://[::ffff:127.0.0.1]/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://[::ffff:10.0.2.2]/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://[::192.168.1.14]/pin.png") == "host not allowlisted")
}

@Test
func rejectsAPrivateHostHiddenByPercentEncoding() {
  // `URLComponents.host` decodes, so the address the request would reach is the one classified.
  #expect(rejectReason("http://%31%30.0.2.2/pin.png") == "host not allowlisted")
  #expect(rejectReason("http://%6c%6f%63%61%6c%68%6f%73%74/pin.png") == "host not allowlisted")
}

@Test
func rejectsMalformedAndCredentialBearingUris() {
  #expect(rejectReason("ftp://example.com/pin.png") == "unsupported scheme")
  #expect(rejectReason("//example.com/pin.png") == "missing scheme")
  #expect(rejectReason("http:///pin.png") == "missing host")
  #expect(rejectReason("http://exa mple.com/pin.png") == "invalid URI")
  #expect(rejectReason("https://user:secret@example.com/pin.png") == "user info not allowed")
  #expect(rejectReason("https://:secret@example.com/pin.png") == "user info not allowed")
}

@Test
func allowsAPublicHost() {
  #expect(rejectReason("https://cdn.example.com/pin.png") == nil)
  #expect(rejectReason("https://93.184.216.34/pin.png") == nil)
  #expect(rejectReason("https://[2606:2800:220:1:248:1893:25c8:1946]/pin.png") == nil)
}

@Test
func skipsTheHostPolicyForABundledImage() {
  // The packager URL a development build resolves `require('./pin.png')` to; the origin stamp is
  // the only thing keeping it out of the rejections above.
  #expect(
    rejectReason("http://localhost:8081/assets/?unstable_path=./assets/pin.png", isBundled: true)
      == nil)
}

@Test
func appliesTheHostPolicyToAnImageTheAppDidNotBundle() {
  #expect(
    rejectReason("http://localhost:8081/assets/?unstable_path=./assets/pin.png")
      == "host not allowlisted")
}

@Test
func classifiesANumericLiteralWithoutDeferringToDns() {
  // The resolving pass answers a literal the same way the pre-check does, so a reachable
  // private address never reaches the network even once the caller is off the main thread.
  #expect(
    RemoteMarkerUriPolicy.rejectReason(
      uri: "http://127.0.0.1:8081/pin.png", isBundled: false, resolveHostAddress: true)
      == "host not allowlisted")
  #expect(
    RemoteMarkerUriPolicy.rejectReason(
      uri: "http://[fd00::1]/pin.png", isBundled: false, resolveHostAddress: true)
      == "host not allowlisted")
}

@Test
func classifiesWhatTheResolverAnswers() {
  // A numeric literal is answered by `getaddrinfo` without a DNS query, so this exercises the
  // real resolver path — sockaddr parsing and byte order included — while staying off the
  // network. Reading `sin_addr` in the wrong order would let 10.0.2.2 through as 2.2.0.10.
  #expect(!RemoteMarkerUriPolicy.isAllowlistedResolvedHost("127.0.0.1"))
  #expect(!RemoteMarkerUriPolicy.isAllowlistedResolvedHost("10.0.2.2"))
  #expect(!RemoteMarkerUriPolicy.isAllowlistedResolvedHost("192.168.1.14"))
  #expect(RemoteMarkerUriPolicy.isAllowlistedResolvedHost("93.184.216.34"))

  #expect(!RemoteMarkerUriPolicy.isAllowlistedResolvedHost("::1"))
  #expect(!RemoteMarkerUriPolicy.isAllowlistedResolvedHost("[::1]"))
  #expect(!RemoteMarkerUriPolicy.isAllowlistedResolvedHost("fd00::1"))
  #expect(!RemoteMarkerUriPolicy.isAllowlistedResolvedHost("::ffff:10.0.2.2"))
  #expect(RemoteMarkerUriPolicy.isAllowlistedResolvedHost("2606:2800:220:1:248:1893:25c8:1946"))
}
