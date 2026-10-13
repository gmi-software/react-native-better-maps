import XCTest

@testable import NitroMaps

final class MapProviderConfigurationErrorTests: XCTestCase {
  func testMissingGoogleMapsAPIKeyUsesLocalizedDescription() {
    let error = MapProviderConfigurationError.missingGoogleMapsIosApiKey

    XCTAssertEqual(
      String(describing: error),
      "react-native-better-maps: provider=\"google\" on iOS requires GoogleMapsIosApiKey in the host app Info.plist."
    )
    XCTAssertEqual(String(describing: error), error.localizedDescription)
  }

  func testUnlinkedGoogleMapsSDKUsesLocalizedDescription() {
    let error = MapProviderConfigurationError.googleMapsSdkNotLinked

    XCTAssertEqual(
      String(describing: error),
      "react-native-better-maps: provider=\"google\" on iOS requires the Google Maps SDK to be linked. Configure iosGoogleMapsApiKey or googleMapsApiKey in the config plugin, or set betterMaps.iosGoogleProvider=true in Podfile.properties.json, then run pod install."
    )
    XCTAssertEqual(String(describing: error), error.localizedDescription)
  }

  func testUnsupportedProviderUsesLocalizedDescription() {
    let error = MapProviderConfigurationError.unsupportedIOSProvider(.mapbox)

    XCTAssertEqual(String(describing: error), "Map provider \"mapbox\" is not supported on iOS.")
    XCTAssertEqual(String(describing: error), error.localizedDescription)
  }
}
