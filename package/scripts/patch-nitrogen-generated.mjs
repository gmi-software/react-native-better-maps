import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptDir, '..');
const generatedSwiftDir = join(packageDir, 'nitrogen/generated/ios/swift');

function replaceOnce(filePath, from, to) {
  const source = readFileSync(filePath, 'utf8');
  const fromCount = source.split(from).length - 1;
  const toCount = source.split(to).length - 1;

  // Already patched. `to` may itself contain `from` (an inserted line after
  // an anchor), so only the occurrences outside `to` count as unpatched.
  if (toCount === 1 && fromCount === to.split(from).length - 1) {
    return;
  }

  if (fromCount !== 1 || toCount !== 0) {
    throw new Error(
      `Expected exactly one patch target in ${filePath}, found ${fromCount}`,
    );
  }

  writeFileSync(filePath, source.replace(from, to));
}

for (const name of ['MapView', 'MarkerView']) {
  replaceOnce(
    join(
      packageDir,
      `nitrogen/generated/shared/c++/views/Hybrid${name}Component.cpp`,
    ),
    `    const std::shared_ptr<const Hybrid${name}Props>& constProps = concreteShadowNode.getConcreteSharedProps();
    const std::shared_ptr<Hybrid${name}Props>& props = std::const_pointer_cast<Hybrid${name}Props>(constProps);
`,
    `    auto constProps = std::static_pointer_cast<const Hybrid${name}Props>(concreteShadowNode.getProps());
    auto props = std::const_pointer_cast<Hybrid${name}Props>(constProps);
`,
  );

  replaceOnce(
    join(
      packageDir,
      `nitrogen/generated/shared/c++/views/Hybrid${name}Component.hpp`,
    ),
    `  Hybrid${name}State(const Hybrid${name}State& /* previousState */, folly::dynamic /* data */) {}
`,
    `  Hybrid${name}State(const Hybrid${name}State& previousState, folly::dynamic /* data */):
    _props(previousState.getProps()) {}
`,
  );
}

// A live marker is placed by a native transform that Yoga never sees. Its
// shadow node reports the same translation, read from the projection registry
// the native host publishes to, so `measure()` - and with it `Pressable`'s
// press-retention rect - sees the marker where the finger does. No JS and no
// Yoga commit per camera frame.
const markerViewComponentHeader = join(
  packageDir,
  'nitrogen/generated/shared/c++/views/HybridMarkerViewComponent.hpp',
);
replaceOnce(
  markerViewComponentHeader,
  '#include <react/renderer/components/view/ViewProps.h>\n',
  '#include <react/renderer/components/view/ViewProps.h>\n#include "MarkerProjectionRegistry.hpp"\n',
);
replaceOnce(
  markerViewComponentHeader,
  `  using HybridMarkerViewShadowNode = react::ConcreteViewShadowNode<HybridMarkerViewComponentName /* "HybridMarkerView" */,
                                                                   HybridMarkerViewProps /* custom props */,
                                                                   react::ViewEventEmitter /* default */,
                                                                   HybridMarkerViewState /* custom state */>;`,
  `  class HybridMarkerViewShadowNode final: public react::ConcreteViewShadowNode<HybridMarkerViewComponentName,
                                                                                  HybridMarkerViewProps,
                                                                                  react::ViewEventEmitter,
                                                                                  HybridMarkerViewState> {
  public:
    using BaseShadowNode = react::ConcreteViewShadowNode<HybridMarkerViewComponentName,
                                                          HybridMarkerViewProps,
                                                          react::ViewEventEmitter,
                                                          HybridMarkerViewState>;
    using BaseShadowNode::BaseShadowNode;

    react::Transform getTransform() const override {
      const auto offset = markerProjection(getTag());
      return react::Transform::Translate(offset.x, offset.y, 0) * BaseShadowNode::getTransform();
    }
  };`,
);

for (const fileName of [
  'Func_void_std__vector_std__string__Coordinate.swift',
  'HybridMapViewSpec_cxx.swift',
  'PolygonDescriptor.swift',
  'PolylineDescriptor.swift',
]) {
  replaceOnce(
    join(generatedSwiftDir, fileName),
    'import NitroModules\n',
    'import CxxStdlib\nimport NitroModules\n',
  );
}

for (const fileName of [
  'PolygonDescriptor.swift',
  'PolylineDescriptor.swift',
]) {
  replaceOnce(
    join(generatedSwiftDir, fileName),
    '    return self.__coordinates.map({ __item in __item })\n',
    `    let count = Int(self.__coordinates.size())
    return (0..<count).map { index in self.__coordinates[index] }
`,
  );
}

replaceOnce(
  join(generatedSwiftDir, 'PolygonDescriptor.swift'),
  '        return __unwrapped.map({ __item in __item.map({ __item in __item }) })\n',
  `        let holeCount = Int(__unwrapped.size())
        return (0..<holeCount).map { holeIndex in
          let hole = __unwrapped[holeIndex]
          let coordinateCount = Int(hole.size())
          return (0..<coordinateCount).map { coordinateIndex in
            hole[coordinateIndex]
          }
        }
`,
);

replaceOnce(
  join(generatedSwiftDir, 'HybridMapViewSpec_cxx.swift'),
  'coordinates: coordinates.map({ __item in __item })',
  'coordinates: (0..<Int(coordinates.size())).map({ index in coordinates[index] })',
);

// Nitro views take no children. Both views here do: MapView mounts its live
// markers, MarkerView its JSX. Fabric hands each child to the Swift content
// view, which decides where it goes - never the SDK reparenting RN views.
for (const name of ['MapView', 'MarkerView']) {
  const file = join(
    packageDir,
    `nitrogen/generated/ios/c++/views/Hybrid${name}Component.mm`,
  );
  replaceOnce(
    file,
    `@interface Hybrid${name}Component: RCTViewComponentView`,
    `// Implemented by the Swift content views through explicit @objc selectors.
@interface UIView (NitroMapsFabricChildren)
- (void)nitroMountChild:(UIView *)child atIndex:(NSInteger)index;
- (void)nitroUnmountChild:(UIView *)child;
@end

@interface Hybrid${name}Component: RCTViewComponentView`,
  );
  replaceOnce(
    file,
    '- (void) updateView {',
    `- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  [self.contentView nitroMountChild:child atIndex:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  [self.contentView nitroUnmountChild:child];
}

- (void) updateView {`,
  );
}

// Fabric on Android mounts children only through a ViewGroupManager. MapView
// keeps the SDK view out of the child indices Fabric sees.
for (const name of ['MapView', 'MarkerView']) {
  const file = join(
    packageDir,
    `nitrogen/generated/android/kotlin/com/margelo/nitro/nitromaps/views/Hybrid${name}Manager.kt`,
  );
  replaceOnce(
    file,
    'import android.view.View\n',
    'import android.view.View\nimport android.view.ViewGroup\n',
  );
  replaceOnce(
    file,
    'import com.facebook.react.uimanager.SimpleViewManager\n',
    'import com.facebook.react.uimanager.ViewGroupManager\n',
  );
  replaceOnce(
    file,
    `public class Hybrid${name}Manager: SimpleViewManager<View>() {`,
    `public class Hybrid${name}Manager: ViewGroupManager<ViewGroup>() {`,
  );
  replaceOnce(
    file,
    'override fun createViewInstance(reactContext: ThemedReactContext): View {',
    'override fun createViewInstance(reactContext: ThemedReactContext): ViewGroup {',
  );
  replaceOnce(
    file,
    'override fun updateState(view: View, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {',
    'override fun updateState(view: ViewGroup, props: ReactStylesDiffMap, stateWrapper: StateWrapper): Any? {',
  );
  replaceOnce(
    file,
    'override fun onDropViewInstance(view: View) {',
    'override fun onDropViewInstance(view: ViewGroup) {',
  );
  replaceOnce(
    file,
    'protected override fun prepareToRecycleView(reactContext: ThemedReactContext, view: View): View? {',
    'protected override fun prepareToRecycleView(reactContext: ThemedReactContext, view: ViewGroup): ViewGroup? {',
  );
}

replaceOnce(
  join(
    packageDir,
    'nitrogen/generated/android/kotlin/com/margelo/nitro/nitromaps/views/HybridMapViewManager.kt',
  ),
  '  override fun getName(): String {',
  `  override fun addView(parent: ViewGroup, child: View, index: Int) {
    (parent as NitroMapContainerView).addMarkerView(child, index)
  }

  override fun getChildCount(parent: ViewGroup): Int = (parent as NitroMapContainerView).markerViewCount

  override fun getChildAt(parent: ViewGroup, index: Int): View = (parent as NitroMapContainerView).markerViewAt(index)

  override fun removeViewAt(parent: ViewGroup, index: Int) {
    (parent as NitroMapContainerView).removeMarkerViewAt(index)
  }

  override fun removeAllViews(parent: ViewGroup) {
    (parent as NitroMapContainerView).removeAllMarkerViews()
  }

  override fun getName(): String {`,
);
