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

// Explicit Fabric mount targets: no SDK-driven reparenting of RN children.
for (const name of ['MapView', 'MarkerView']) {
  const file = join(
    packageDir,
    `nitrogen/generated/ios/c++/views/Hybrid${name}Component.mm`,
  );
  replaceOnce(
    file,
    `@interface Hybrid${name}Component: RCTViewComponentView`,
    `// Implemented by both Swift content containers via explicit @objc selectors.
@interface UIView (NitroMapFabricChildren)
- (void)nitroMountChild:(UIView *)child atIndex:(NSInteger)index;
- (void)nitroUnmountChild:(UIView *)child;
@end

@interface Hybrid${name}Component: RCTViewComponentView`,
  );
  replaceOnce(
    file,
    '- (void) updateView {',
    `
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  NSAssert(child.superview == nil, @"Marker child is already mounted");
  [self.contentView nitroMountChild:child atIndex:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  [self.contentView nitroUnmountChild:child];
}

- (void) updateView {`,
  );
}

// Android must expose a ViewGroupManager for Fabric to mount descendants.
for (const name of ['MapView', 'MarkerView']) {
  const file = join(
    packageDir,
    `nitrogen/generated/android/kotlin/com/margelo/nitro/nitromaps/views/Hybrid${name}Manager.kt`,
  );
  const source = readFileSync(file, 'utf8');
  if (source.includes('SimpleViewManager<View>()')) {
    writeFileSync(
      file,
      source
        .replace(
          'import android.view.View\n',
          'import android.view.View\nimport android.view.ViewGroup\n',
        )
        .replace(
          'import com.facebook.react.uimanager.SimpleViewManager',
          'import com.facebook.react.uimanager.ViewGroupManager',
        )
        .replace('SimpleViewManager<View>()', 'ViewGroupManager<ViewGroup>()')
        .replaceAll('view: View', 'view: ViewGroup')
        .replace(
          'createViewInstance(reactContext: ThemedReactContext): View',
          'createViewInstance(reactContext: ThemedReactContext): ViewGroup',
        )
        .replace('view: ViewGroup): View?', 'view: ViewGroup): ViewGroup?'),
    );
  } else if (!source.includes('ViewGroupManager<ViewGroup>()')) {
    throw new Error(`Unexpected generated manager shape: ${file}`);
  }
  if (name === 'MapView') {
    replaceOnce(
      file,
      '  override fun getName(): String {',
      `  override fun addView(parent: ViewGroup, child: View, index: Int) {
    (parent as NitroMapContainerView).addMarkerView(child, index)
  }
  override fun getChildCount(parent: ViewGroup): Int = (parent as NitroMapContainerView).markerViewCount()
  override fun getChildAt(parent: ViewGroup, index: Int): View = (parent as NitroMapContainerView).markerViewAt(index)
  override fun removeViewAt(parent: ViewGroup, index: Int) { (parent as NitroMapContainerView).removeMarkerViewAt(index) }
  override fun removeAllViews(parent: ViewGroup) { (parent as NitroMapContainerView).removeAllMarkerViews() }

  override fun getName(): String {`,
    );
  }
}
