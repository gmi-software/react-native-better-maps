// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "NitroMapsColorParser",
  platforms: [.macOS(.v13)],
  targets: [
    .target(
      name: "NitroMapsColorParser",
      path: "ColorParser"
    ),
    .testTarget(
      name: "NitroMapsColorParserTests",
      dependencies: ["NitroMapsColorParser"],
      path: "Tests"
    ),
  ]
)
