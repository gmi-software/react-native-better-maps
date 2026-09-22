import OSLog
import UIKit

/// Loads marker images from bundled assets or remote URLs with in-memory caching.
/// Local images decode off-thread; completions always land on main.
enum MarkerImageLoader {
  private static let cache = NSCache<NSString, UIImage>()
  /// Not `URLSession.shared`, which cannot carry a delegate: without one the policy would check
  /// the URL the app supplied and then follow a redirect anywhere, which is the cheapest way to
  /// defeat it — an attacker-controlled public host answering 302 to a private address.
  private static let session: URLSession = {
    URLSession(
      configuration: .default,
      delegate: RedirectPolicyDelegate(),
      delegateQueue: nil
    )
  }()
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

  /// Logged twice on purpose. A rejected URI can carry the very thing that got it rejected —
  /// `user:password@` is one of the reasons — and a query string can hold a signed token, so the
  /// public half is stripped of both. The full URI follows as private: the unified log keeps it
  /// out of a shipped app's logs, and a developer attached to the simulator or a debugger still
  /// sees it. That matters because Metro puts the asset's identity in the query string, so the
  /// stripped form alone does not say which image was refused.
  private static func logRejected(uri: String, reason: String) {
    logger.warning(
      """
      Rejected remote marker image URI (\(reason, privacy: .public)): \
      \(RemoteMarkerUriPolicy.loggableURI(uri), privacy: .public) \
      [full: \(uri, privacy: .private)]
      """
    )
  }

  private static func startRemoteTask(
    url: URL,
    cacheKey: NSString,
    image: MarkerImage,
    completion: @escaping (UIImage?) -> Void
  ) {
    let task = session.dataTask(with: url) { data, _, _ in
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
    }
    // The delegate sees tasks, not images, so the exemption has to travel with the task.
    task.taskDescription = image.origin == .bundled ? bundledTaskDescription : nil
    task.resume()
  }

  private static let bundledTaskDescription = "com.nitromaps.bundledMarkerImage"

  /// Re-runs the host policy on every redirect destination. Without it the policy would only ever
  /// see the URL the app supplied.
  private final class RedirectPolicyDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
      _ session: URLSession,
      task: URLSessionTask,
      willPerformHTTPRedirection response: HTTPURLResponse,
      newRequest request: URLRequest,
      completionHandler: @escaping (URLRequest?) -> Void
    ) {
      if task.taskDescription == MarkerImageLoader.bundledTaskDescription {
        completionHandler(request)
        return
      }

      guard let uri = request.url?.absoluteString else {
        completionHandler(nil)
        return
      }

      // Off the delegate queue: resolving blocks, and this queue also delivers completions.
      MarkerImageLoader.policyQueue.async {
        if let reason = RemoteMarkerUriPolicy.rejectReason(
          uri: uri,
          isBundled: false,
          resolveHostAddress: true
        ) {
          MarkerImageLoader.logRejected(uri: uri, reason: "redirect: \(reason)")
          // `nil` stops the redirect; the task completes with the redirect response body.
          completionHandler(nil)
          return
        }
        completionHandler(request)
      }
    }
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
