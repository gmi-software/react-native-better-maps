import Foundation

/// Decides whether a marker image may be fetched over the network.
///
/// The policy exists for URLs that arrive as *data* — `image={{ uri: apiResponse.iconUrl }}`
/// pointing at a router admin page or a cloud metadata endpoint — so it only applies to images the
/// app did not bundle. A `require()`d asset carries `MarkerImageOrigin.bundled` from the JS side and
/// skips the check: a development build resolves it to a Metro packager URL, whose address is always
/// private (`localhost` through the simulator, `192.168.x.x` on a device), so the host cannot tell a
/// bundled asset apart from the addresses this policy blocks.
///
/// Mirrors `RemoteMarkerUriPolicy.kt`. The two are meant to answer the same way for the same URL;
/// the divergences that Foundation forces are called out where they happen.
enum RemoteMarkerUriPolicy {
  /// Whether `uriString` is fetched over the network rather than read from the app bundle.
  static func isRemoteUri(_ uriString: String) -> Bool {
    guard let scheme = URLComponents(string: uriString)?.scheme?.lowercased() else {
      return false
    }
    return scheme == "http" || scheme == "https"
  }

  /// Returns why the image must not be fetched, or `nil` when the fetch is allowed.
  ///
  /// - Parameters:
  ///   - isBundled: whether the image was stamped `MarkerImageOrigin.bundled` on the JS side.
  ///   - resolveHostAddress: whether a host name may be resolved through DNS. `false` for the
  ///     pre-check on the calling thread, `true` once the caller has hopped to a background queue,
  ///     so only a numeric host literal is classified before the thread hop.
  static func rejectReason(
    uri uriString: String,
    isBundled: Bool,
    resolveHostAddress: Bool
  ) -> String? {
    if isBundled {
      return nil
    }

    guard let components = URLComponents(string: uriString) else {
      return "invalid URI"
    }

    switch components.scheme?.lowercased() {
    case "http", "https": break
    case nil: return "missing scheme"
    default: return "unsupported scheme"
    }

    // Two accessors, because `user` is `nil` for `http://:secret@host` while `password` is not.
    if components.user != nil || components.password != nil {
      return "user info not allowed"
    }

    // `host` is the decoded form, so `http://%31%30.0.2.2/` is classified as the 10.0.2.2 it
    // resolves to rather than as an opaque name. `encodedHost` is the ASCII wire form, which is
    // what DNS takes for an internationalised name.
    guard let host = components.host?.lowercased(), !host.isEmpty else {
      return "missing host"
    }

    let allowed = isAllowlistedHost(
      host,
      encodedHost: components.encodedHost?.lowercased(),
      resolveHostAddress: resolveHostAddress
    )
    return allowed ? nil : "host not allowlisted"
  }

  /// The resolving half of the host check, without the URL parsing around it.
  ///
  /// Blocking: only call it off the thread the caller came in on.
  static func isAllowlistedResolvedHost(_ host: String) -> Bool {
    let addresses = resolveAddresses(of: bracketless(host))
    if addresses.isEmpty {
      return false
    }
    // Stricter than the Kotlin original, which classifies `InetAddress.getByName`'s first answer
    // only: a name that resolves to both a public and a private address is rejected.
    return addresses.allSatisfy(isAllowlistedAddress)
  }

  private static func isAllowlistedHost(
    _ host: String,
    encodedHost: String?,
    resolveHostAddress: Bool
  ) -> Bool {
    if host == "localhost" || host.hasSuffix(".localhost") || host.hasSuffix(".local") {
      return false
    }
    if blockedHosts.contains(host) {
      return false
    }

    if let literal = parseLiteral(bracketless(host)) {
      return isAllowlistedAddress(literal)
    }

    // A name can only be classified by resolving it, and that must not happen on the calling
    // thread. Allow it here; the pass that may resolve makes the real decision.
    if !resolveHostAddress {
      return true
    }

    return isAllowlistedResolvedHost(encodedHost ?? host)
  }

  /// An address reduced to the bytes the classification needs.
  private enum IPAddress {
    /// Host byte order.
    case v4(UInt32)
    /// 16 bytes, network order.
    case v6([UInt8])
  }

  private static func parseLiteral(_ text: String) -> IPAddress? {
    var v4 = in_addr()
    if inet_pton(AF_INET, text, &v4) == 1 {
      return .v4(UInt32(bigEndian: v4.s_addr))
    }

    var v6 = in6_addr()
    if inet_pton(AF_INET6, text, &v6) == 1 {
      return ipAddress(from: v6)
    }

    return nil
  }

  private static func ipAddress(from address: in6_addr) -> IPAddress {
    var bytes = [UInt8](repeating: 0, count: 16)
    withUnsafeBytes(of: address) { raw in
      for index in 0..<16 {
        bytes[index] = raw[index]
      }
    }

    if let embedded = embeddedIPv4(in: bytes) {
      return .v4(embedded)
    }
    return .v6(bytes)
  }

  /// The IPv4 address inside `::ffff:a.b.c.d` or `::a.b.c.d`, which every stack routes to the v4
  /// address it wraps. `InetAddress.getByName` unwraps the mapped form on its own, so without this
  /// `::ffff:127.0.0.1` would pass every IPv6 rule.
  private static func embeddedIPv4(in bytes: [UInt8]) -> UInt32? {
    guard bytes[0..<10].allSatisfy({ $0 == 0 }) else {
      return nil
    }

    let isMapped = bytes[10] == 0xff && bytes[11] == 0xff
    let isCompatible = bytes[10] == 0 && bytes[11] == 0
    guard isMapped || isCompatible else {
      return nil
    }

    let value =
      UInt32(bytes[12]) << 24 | UInt32(bytes[13]) << 16 | UInt32(bytes[14]) << 8 | UInt32(bytes[15])
    // `::` and `::1` are the unspecified and loopback addresses, not an embedded IPv4.
    if isCompatible && value <= 1 {
      return nil
    }
    return value
  }

  private static func isAllowlistedAddress(_ address: IPAddress) -> Bool {
    switch address {
    case .v4(let value):
      let first = UInt8(truncatingIfNeeded: value >> 24)
      let second = UInt8(truncatingIfNeeded: value >> 16)

      if value == 0 { return false }  // any-local
      if first == 127 { return false }  // loopback
      if first == 169 && second == 254 { return false }  // link-local
      if first == 10 { return false }  // site-local
      if first == 172 && (second & 0xf0) == 16 { return false }  // site-local
      if first == 192 && second == 168 { return false }  // site-local
      if (first & 0xf0) == 0xe0 { return false }  // multicast
      return true

    case .v6(let bytes):
      if bytes.allSatisfy({ $0 == 0 }) { return false }  // any-local
      if bytes[0..<15].allSatisfy({ $0 == 0 }) && bytes[15] == 1 { return false }  // loopback
      if bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0x80 { return false }  // link-local
      if bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0xc0 { return false }  // site-local
      if bytes[0] == 0xff { return false }  // multicast
      if (bytes[0] & 0xfe) == 0xfc { return false }  // unique-local
      return true
    }
  }

  /// Blocking, so it may only run off the thread the caller came in on.
  private static func resolveAddresses(of host: String) -> [IPAddress] {
    var hints = addrinfo()
    hints.ai_family = AF_UNSPEC
    hints.ai_socktype = SOCK_STREAM

    var result: UnsafeMutablePointer<addrinfo>?
    guard getaddrinfo(host, nil, &hints, &result) == 0, let head = result else {
      return []
    }
    defer { freeaddrinfo(head) }

    var addresses: [IPAddress] = []
    var entry: UnsafeMutablePointer<addrinfo>? = head
    while let current = entry {
      if let socketAddress = current.pointee.ai_addr {
        switch Int32(socketAddress.pointee.sa_family) {
        case AF_INET:
          socketAddress.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
            addresses.append(.v4(UInt32(bigEndian: $0.pointee.sin_addr.s_addr)))
          }
        case AF_INET6:
          socketAddress.withMemoryRebound(to: sockaddr_in6.self, capacity: 1) {
            addresses.append(ipAddress(from: $0.pointee.sin6_addr))
          }
        default:
          break
        }
      }
      entry = current.pointee.ai_next
    }
    return addresses
  }

  /// `URLComponents.host` keeps the brackets around an IPv6 literal, the way `URI.getHost` does;
  /// `inet_pton` and `getaddrinfo` reject them.
  private static func bracketless(_ host: String) -> String {
    guard host.count > 2, host.hasPrefix("["), host.hasSuffix("]") else {
      return host
    }
    return String(host.dropFirst().dropLast())
  }

  private static let blockedHosts: Set<String> = [
    "metadata.google.internal",
    "metadata.goog",
  ]
}
