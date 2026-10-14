// swift-tools-version: 6.0

import PackageDescription

// Holds the parts of package/ios that need no MapKit, UIKit or Nitro-generated
// types, so `swift test` can cover them. The podspec compiles them as well.
let package = Package(
  name: "NitroMapsSupport",
  platforms: [.macOS(.v13)],
  targets: [
    .target(
      name: "NitroMapsCamera",
      path: "Camera"
    ),
    .target(
      name: "NitroMapsColorParser",
      path: "ColorParser"
    ),
    .target(
      name: "NitroMapsGeometry",
      path: "Geometry"
    ),
    .target(
      name: "NitroMapsClusterBadge",
      path: "ClusterBadge"
    ),
    .target(
      name: "NitroMapsAdapterSlot",
      path: "AdapterSlot"
    ),
    .target(
      name: "NitroMapsShapeDiff",
      path: "ShapeDiff"
    ),
    .target(
      name: "NitroMapsRemoteImagePolicy",
      path: "RemoteImagePolicy"
    ),
    .testTarget(
      name: "NitroMapsCameraTests",
      dependencies: ["NitroMapsCamera"],
      path: "Tests/Camera"
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
      name: "NitroMapsClusterBadgeTests",
      // The color parser checks that every color in the style is valid hex.
      dependencies: ["NitroMapsClusterBadge", "NitroMapsColorParser"],
      path: "Tests/ClusterBadge"
    ),
    .testTarget(
      name: "NitroMapsAdapterSlotTests",
      dependencies: ["NitroMapsAdapterSlot"],
      path: "Tests/AdapterSlot"
    ),
    .testTarget(
      name: "NitroMapsShapeDiffTests",
      dependencies: ["NitroMapsShapeDiff"],
      path: "Tests/ShapeDiff"
    ),
    .testTarget(
      name: "NitroMapsRemoteImagePolicyTests",
      dependencies: ["NitroMapsRemoteImagePolicy"],
      path: "Tests/RemoteImagePolicy"
    ),
  ]
)
