import Testing

@testable import NitroMapsAdapterSlot

// ProviderAdapterSlotTest.kt checks the same cases on Android, plus a build that
// throws, which the iOS factory cannot.

private final class FakeAdapter {
  let configuration: String

  init(configuration: String) {
    self.configuration = configuration
  }
}

private final class EventLog {
  var events: [String] = []
}

private func makeSlot(logging log: EventLog) -> ProviderAdapterSlot<String, FakeAdapter> {
  ProviderAdapterSlot(
    build: { configuration in
      log.events.append("build \(configuration)")
      return FakeAdapter(configuration: configuration)
    },
    destroy: { adapter in log.events.append("destroy \(adapter.configuration)") }
  )
}

@Test
func buildsTheFirstAdapterFromTheCommittedConfiguration() {
  let log = EventLog()
  let slot = makeSlot(logging: log)

  let built = slot.commit("google map-id")

  #expect(built?.configuration == "google map-id")
  #expect(built === slot.adapter)
  #expect(log.events == ["build google map-id"])
}

@Test
func keepsTheAdapterWhenTheConfigurationIsUnchanged() {
  let log = EventLog()
  let slot = makeSlot(logging: log)
  let built = slot.commit("google map-id")

  #expect(slot.commit("google map-id") == nil)
  #expect(built === slot.adapter)
  #expect(log.events == ["build google map-id"])
}

@Test
func destroysTheCurrentAdapterBeforeBuildingTheNext() {
  let log = EventLog()
  let slot = makeSlot(logging: log)

  slot.commit("google map-a")
  let rebuilt = slot.commit("google map-b")

  #expect(rebuilt?.configuration == "google map-b")
  #expect(rebuilt === slot.adapter)
  #expect(log.events == ["build google map-a", "destroy google map-a", "build google map-b"])
}

@Test
func buildsAgainAfterARelease() {
  let log = EventLog()
  let slot = makeSlot(logging: log)

  slot.commit("google map-id")
  slot.release()

  #expect(slot.adapter == nil)
  #expect(slot.commit("google map-id")?.configuration == "google map-id")
  #expect(log.events == ["build google map-id", "destroy google map-id", "build google map-id"])
}

@Test
func releasesNothingWhenThereIsNoAdapter() {
  let log = EventLog()
  let slot = makeSlot(logging: log)

  slot.release()

  #expect(slot.adapter == nil)
  #expect(log.events.isEmpty)
}
