import Testing

@testable import NitroMapsGeometry

@Test
func acceptsASpanThatCoversAnArea() {
  #expect(RegionSpan.isDrawable(latitudeDelta: 0.1, longitudeDelta: 0.1))
  #expect(RegionSpan.isDrawable(latitudeDelta: 180, longitudeDelta: 360))
}

@Test
func rejectsASpanThatCoversNoArea() {
  #expect(!RegionSpan.isDrawable(latitudeDelta: 0, longitudeDelta: 0.1))
  #expect(!RegionSpan.isDrawable(latitudeDelta: 0.1, longitudeDelta: 0))
  #expect(!RegionSpan.isDrawable(latitudeDelta: -0.1, longitudeDelta: 0.1))
  #expect(!RegionSpan.isDrawable(latitudeDelta: .nan, longitudeDelta: 0.1))
  #expect(!RegionSpan.isDrawable(latitudeDelta: 0.1, longitudeDelta: .infinity))
}
