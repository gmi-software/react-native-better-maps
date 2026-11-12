import MapKit
import UIKit
import XCTest

@testable import NitroMaps

final class HybridMapViewDelegateTests: XCTestCase {
  func testRejectsLongPressWhenTouchHitsAnAnnotationView() {
    let annotationView = MKAnnotationView(annotation: nil, reuseIdentifier: nil)
    let delegate = HybridMapViewDelegate(hitTest: { _, _ in annotationView })

    XCTAssertFalse(delegate.shouldReceiveLongPress(at: .zero, in: UIView()))
  }

  func testRejectsLongPressWhenTouchHitsSubviewInsideAnnotationView() {
    let annotationView = MKAnnotationView(annotation: nil, reuseIdentifier: nil)
    let nestedView = UIView()
    annotationView.addSubview(nestedView)
    let delegate = HybridMapViewDelegate(hitTest: { _, _ in nestedView })

    XCTAssertFalse(delegate.shouldReceiveLongPress(at: .zero, in: UIView()))
  }

  func testAllowsLongPressWhenTouchHitsOrdinaryView() {
    let backgroundView = UIView()
    let delegate = HybridMapViewDelegate(hitTest: { _, _ in backgroundView })

    XCTAssertTrue(delegate.shouldReceiveLongPress(at: .zero, in: UIView()))
  }

  func testAllowsLongPressWhenHitTestReturnsNoView() {
    let delegate = HybridMapViewDelegate(hitTest: { _, _ in nil })

    XCTAssertTrue(delegate.shouldReceiveLongPress(at: .zero, in: UIView()))
  }
}
