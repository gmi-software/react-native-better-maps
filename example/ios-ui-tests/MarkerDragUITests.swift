import XCTest

final class MarkerDragUITests: XCTestCase {
  private var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication()
    app.launch()
  }

  func testDraggingPinAndImageMarkersOnlyFiresDragEnd() throws {
    let scenarioButton = app.buttons["Marker drag regression"]
    XCTAssertTrue(scenarioButton.waitForExistence(timeout: 30))

    let scenarioStrip = app.scrollViews.firstMatch
    for _ in 0..<12 {
      if scenarioButton.isHittable {
        break
      }
      scenarioStrip.swipeLeft()
    }
    XCTAssertTrue(scenarioButton.isHittable)
    scenarioButton.tap()

    let map = app.descendants(matching: .any)
      .matching(identifier: "marker-drag-regression-map")
      .firstMatch
    XCTAssertTrue(map.waitForExistence(timeout: 30))

    let result = app.staticTexts["marker-drag-verification-status"]
    XCTAssertTrue(result.waitForExistence(timeout: 30))
    waitForStatus(result, containing: ["pin=0", "image=0", "ready=true"])
    let initialLongPressCount = longPressCount(from: result.label)

    let pin = app.descendants(matching: .any)
      .matching(NSPredicate(format: "label == %@", "Draggable pin"))
      .firstMatch
    XCTAssertTrue(pin.waitForExistence(timeout: 30), "The pin annotation must be exposed at its rendered position.")
    XCTAssertTrue(pin.isHittable, "The rendered pin annotation must be hittable.")
    XCTAssertGreaterThan(pin.frame.width, 0)
    XCTAssertGreaterThan(pin.frame.height, 0)

    let pinStart = pin.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    let pinEnd = map.coordinate(withNormalizedOffset: CGVector(dx: 0.40, dy: 0.48))
    pinStart.press(forDuration: 1.0, thenDragTo: pinEnd)
    waitForStatus(result, containing: ["pin=1", "image=0", "long=\(initialLongPressCount)"])

    let image = app.descendants(matching: .any)
      .matching(NSPredicate(format: "label == %@", "Draggable image"))
      .firstMatch
    XCTAssertTrue(image.waitForExistence(timeout: 30), "The image annotation must be exposed at its rendered position.")
    XCTAssertTrue(image.isHittable, "The rendered image annotation must be hittable.")
    XCTAssertGreaterThan(image.frame.width, 0)
    XCTAssertGreaterThan(image.frame.height, 0)

    let imageStart = image.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    let imageEnd = map.coordinate(withNormalizedOffset: CGVector(dx: 0.60, dy: 0.48))
    imageStart.press(forDuration: 1.0, thenDragTo: imageEnd)
    waitForStatus(result, containing: ["pin=1", "image=1", "long=\(initialLongPressCount)"])
  }

  private func longPressCount(from status: String) -> Int {
    let marker = "long="
    guard
      let range = status.range(of: marker),
      let count = Int(status[range.upperBound...].prefix(while: \\.isNumber))
    else {
      XCTFail("The verification status must include the map long-press count: \(status)")
      return -1
    }
    return count
  }

  private func waitForStatus(_ element: XCUIElement, containing fragments: [String]) {
    let format = fragments.map { _ in "label CONTAINS %@" }.joined(separator: " AND ")
    let predicate = NSPredicate(format: format, argumentArray: fragments)
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
    XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 20), .completed, element.label)
  }
}
