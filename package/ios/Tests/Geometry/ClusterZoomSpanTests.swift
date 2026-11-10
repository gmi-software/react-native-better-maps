import Testing

@testable import NitroMapsGeometry

@Suite
struct ClusterZoomSpanTests {
  @Test
  func padsTheMembersSpreadByAFactorOfOnePointSix() {
    #expect(abs(ClusterZoomSpan.delta(min: 52.0, max: 52.5) - 0.8) < 1e-9)
    #expect(abs(ClusterZoomSpan.delta(min: -0.25, max: 0.25) - 0.8) < 1e-9)
  }

  @Test
  func keepsAMinimumSpanForStackedMembers() {
    #expect(ClusterZoomSpan.delta(min: 52.2297, max: 52.2297) == 0.01)
  }

  @Test
  func keepsTheMinimumUntilThePaddedSpreadPassesIt() {
    #expect(ClusterZoomSpan.delta(min: 0, max: 0.006) == 0.01)
    #expect(abs(ClusterZoomSpan.delta(min: 0, max: 0.01) - 0.016) < 1e-12)
  }
}
