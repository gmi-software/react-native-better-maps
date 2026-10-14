/// Holds a map view's provider adapter and builds a new one only when the
/// configuration it is built from has changed. `HybridMapView` commits to it once
/// per prop transaction.
///
/// `ProviderAdapterSlot.kt` is the Android counterpart; change the two together.
final class ProviderAdapterSlot<Configuration: Equatable, Adapter> {
  private let build: (Configuration) -> Adapter
  private let destroy: (Adapter) -> Void
  private var builtFrom: Configuration?

  private(set) var adapter: Adapter?

  init(
    build: @escaping (Configuration) -> Adapter,
    destroy: @escaping (Adapter) -> Void
  ) {
    self.build = build
    self.destroy = destroy
  }

  /// Makes `adapter` one built from `configuration`: returns it when it had to be
  /// built, and nil when the current one already was. The current adapter is
  /// destroyed before the next one is built, so there are never two at once.
  @discardableResult
  func commit(_ configuration: Configuration) -> Adapter? {
    if adapter != nil, builtFrom == configuration {
      return nil
    }

    release()
    let next = build(configuration)
    adapter = next
    builtFrom = configuration
    return next
  }

  /// Destroys the adapter, if there is one; the next `commit` builds a new one
  /// regardless.
  func release() {
    guard let current = adapter else {
      return
    }

    adapter = nil
    builtFrom = nil
    destroy(current)
  }
}
