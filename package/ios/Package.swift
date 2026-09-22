// swift-tools-version: 6.0

import PackageDescription

// Holds the parts of package/ios that need no MapKit, UIKit or Nitro-generated
// types, so `swift test` can cover them. The podspec compiles them as well.
let package = Package(
  name: "NitroMapsSupport",
  platforms: [.macOS(.v13)],
  targets: [
    .target(
      name: "NitroMapsColorParser",
      path: "ColorParser"
    ),
    .target(
      name: "NitroMapsGeometry",
      path: "Geometry"
    ),
    .target(
      name: "NitroMapsRemoteImagePolicy",
      path: "RemoteImagePolicy"
    ),
    .testTarget(
      name: "NitroMapsColorParserTests",
      dependencies: ["NitroMapsColorParser"],
      path: "Tests/ColorParser"
    ),
    .testTarget(
      name: "NitroMapsGeometryTests",
      dependencies: ["NitroMapsGeometry"],
      path: "Tests/Geometry"
    ),
    .testTarget(
      name: "NitroMapsRemoteImagePolicyTests",
      dependencies: ["NitroMapsRemoteImagePolicy"],
      path: "Tests/RemoteImagePolicy"
    ),
  ]
)
