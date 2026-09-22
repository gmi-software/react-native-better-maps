import OSLog
import UIKit

/// Loads marker images from bundled assets or remote URLs with in-memory caching.
/// Local images decode off-thread; completions always land on main.
enum MarkerImageLoader {
  private static let cache = NSCache<NSString, UIImage>()
  private static let session = URLSession.shared
  private static let decodeQueue = DispatchQueue(
    label: "com.nitromaps.markerImageDecode",
    qos: .userInitiated
  )
  /// Resolving a host blocks, and a slow lookup must not hold up local decoding. Serial rather
  /// than concurrent so a screen full of markers cannot spawn a thread per lookup; the image
  /// cache means each distinct URI is resolved once.
  private static let policyQueue = DispatchQueue(
    label: "com.nitromaps.markerImagePolicy",
    qos: .userInitiated
  )
  /// The category matches `NITRO_MAPS_LOG_TAG` on Android, so a rejected image is found the same
  /// way on both platforms.
  private static let logger = Logger(subsystem: "com.nitromaps", category: "NitroMaps")

  static func cachedImage(for image: MarkerImage) -> UIImage? {
    cache.object(forKey: cacheKey(for: image))
  }

  static func load(
    _ image: MarkerImage,
    completion: @escaping (UIImage?) -> Void
  ) {
    let cacheKey = cacheKey(for: image)
    if let cached = cache.object(forKey: cacheKey) {
      completion(cached)
      return
    }

    let uri = image.uri
    if RemoteMarkerUriPolicy.isRemoteUri(uri) {
      loadRemote(uri: uri, cacheKey: cacheKey, image: image, completion: completion)
      return
    }

    decodeQueue.async {
      let loaded = loadLocal(uri: uri, image: image)
      if let loaded {
        cache.setObject(loaded, forKey: cacheKey)
      }
      DispatchQueue.main.async {
        completion(loaded)
      }
    }
  }

  static func cacheKey(for image: MarkerImage) -> NSString {
    let width = image.width.map { String($0) } ?? ""
    let height = image.height.map { String($0) } ?? ""
    let scale = image.scale.map { String($0) } ?? ""
    // `origin` is part of the key so a bundled image cannot warm the cache for a user-supplied
    // one with the same URI, which would hand it a policy-free entry.
    let origin = image.origin.map { $0.stringValue } ?? ""
    return "\(image.uri)|\(width)|\(height)|\(scale)|\(origin)" as NSString
  }

  private static func loadLocal(uri: String, image: MarkerImage) -> UIImage? {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      if let data = try? Data(contentsOf: url), let uiImage = UIImage(data: data) {
        return resize(uiImage, image: image)
      }
    }

    if uri.hasPrefix("/"), let uiImage = UIImage(contentsOfFile: uri) {
      return resize(uiImage, image: image)
    }

    let name = (uri as NSString).lastPathComponent
    let baseName = (name as NSString).deletingPathExtension
    if let uiImage = UIImage(named: baseName) ?? UIImage(named: name) {
      return resize(uiImage, image: image)
    }

    if let uiImage = UIImage(named: uri) {
      return resize(uiImage, image: image)
    }

    return nil
  }

  private static func loadRemote(
    uri: String,
    cacheKey: NSString,
    image: MarkerImage,
    completion: @escaping (UIImage?) -> Void
  ) {
    // No policy applies to an image the app bundled, so it must not wait behind the host lookup
    // of an unrelated one: in a development build every `require()`d marker takes this path.
    if image.origin == .bundled {
      guard let url = URL(string: uri) else {
        completion(nil)
        return
      }
      startRemoteTask(url: url, cacheKey: cacheKey, image: image, completion: completion)
      return
    }

    // The pre-check classifies a numeric host literal without touching DNS, so the common
    // rejection costs nothing and never leaves the caller's thread.
    if let reason = RemoteMarkerUriPolicy.rejectReason(
      uri: uri,
      isBundled: false,
      resolveHostAddress: false
    ) {
      logRejected(uri: uri, reason: reason)
      completion(nil)
      return
    }

    policyQueue.async {
      if let reason = RemoteMarkerUriPolicy.rejectReason(
        uri: uri,
        isBundled: false,
        resolveHostAddress: true
      ) {
        logRejected(uri: uri, reason: reason)
        DispatchQueue.main.async { completion(nil) }
        return
      }

      guard let url = URL(string: uri) else {
        DispatchQueue.main.async { completion(nil) }
        return
      }

      startRemoteTask(url: url, cacheKey: cacheKey, image: image, completion: completion)
    }
  }

  private static func logRejected(uri: String, reason: String) {
    logger.warning("Rejected remote marker image URI (\(reason, privacy: .public)): \(uri, privacy: .public)")
  }

  private static func startRemoteTask(
    url: URL,
    cacheKey: NSString,
    image: MarkerImage,
    completion: @escaping (UIImage?) -> Void
  ) {
    session.dataTask(with: url) { data, _, _ in
      let uiImage: UIImage?
      if let data, let decoded = UIImage(data: data) {
        uiImage = resize(decoded, image: image)
        if let uiImage {
          cache.setObject(uiImage, forKey: cacheKey)
        }
      } else {
        uiImage = nil
      }

      DispatchQueue.main.async {
        completion(uiImage)
      }
    }.resume()
  }

  private static func resize(_ uiImage: UIImage, image: MarkerImage) -> UIImage {
    guard let width = image.width, let height = image.height else {
      return uiImage
    }

    let targetSize = CGSize(width: CGFloat(width), height: CGFloat(height))

    if uiImage.size == targetSize {
      return uiImage
    }

    let renderer = UIGraphicsImageRenderer(size: targetSize)
    return renderer.image { _ in
      uiImage.draw(in: CGRect(origin: .zero, size: targetSize))
    }
  }
}
