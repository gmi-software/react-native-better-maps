import Foundation

#if canImport(GoogleMaps)
import GoogleMaps

enum GoogleMapsAPIKey {
  private static var configuredKey: String?

  static func configureIfNeeded() throws {
    let key = Bundle.main.object(forInfoDictionaryKey: "GoogleMapsIosApiKey") as? String
    guard let key = key?.trimmingCharacters(in: .whitespacesAndNewlines),
          !key.isEmpty,
          !key.hasPrefix("$(") else {
      throw MapProviderConfigurationError.missingGoogleMapsIosApiKey
    }

    guard configuredKey != key else {
      return
    }

    GMSServices.provideAPIKey(key)
    configuredKey = key
  }
}
#endif

enum MapProviderConfigurationError: LocalizedError {
  case missingGoogleMapsIosApiKey
  case unsupportedIOSProvider(MapProvider)

  var errorDescription: String? {
    switch self {
    case .missingGoogleMapsIosApiKey:
      return "react-native-better-maps: provider=\"google\" on iOS requires GoogleMapsIosApiKey in the host app Info.plist."
    case let .unsupportedIOSProvider(provider):
      return "Map provider \"\(provider)\" is not supported on iOS."
    }
  }
}
