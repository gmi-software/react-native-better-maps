const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  'react-native',
  'import',
  'require',
  'default',
];

// Always resolve the workspace package through one entry point so overlay
// components share the same module instance (required for MapView child collection).
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-better-maps': path.resolve(monorepoRoot, 'package'),
};

module.exports = config;
