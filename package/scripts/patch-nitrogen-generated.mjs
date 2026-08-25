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

  if (fromCount === 0 && toCount === 1) {
    return;
  }

  if (fromCount !== 1) {
    throw new Error(
      `Expected exactly one patch target in ${filePath}, found ${fromCount}`,
    );
  }

  writeFileSync(filePath, source.replace(from, to));
}

replaceOnce(
  join(packageDir, 'nitrogen/generated/shared/c++/views/HybridMapViewComponent.cpp'),
  `    const std::shared_ptr<const HybridMapViewProps>& constProps = concreteShadowNode.getConcreteSharedProps();
    const std::shared_ptr<HybridMapViewProps>& props = std::const_pointer_cast<HybridMapViewProps>(constProps);
`,
  `    auto constProps = std::static_pointer_cast<const HybridMapViewProps>(concreteShadowNode.getProps());
    auto props = std::const_pointer_cast<HybridMapViewProps>(constProps);
`,
);

replaceOnce(
  join(packageDir, 'nitrogen/generated/shared/c++/views/HybridMapViewComponent.hpp'),
  `  HybridMapViewState(const HybridMapViewState& /* previousState */, folly::dynamic /* data */) {}
`,
  `  HybridMapViewState(const HybridMapViewState& previousState, folly::dynamic /* data */):
    _props(previousState.getProps()) {}
`,
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
