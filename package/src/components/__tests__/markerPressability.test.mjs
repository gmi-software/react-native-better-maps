import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
import console from 'node:console';
import process from 'node:process';

// Exercise the installed React Native state machine. A native MarkerView must
// project Fabric's measured page rect to the same position as the touch event.
const exampleRequire = createRequire(
  new URL('../../../../example/package.json', import.meta.url),
);
const reactNativeRequire = createRequire(
  exampleRequire.resolve('react-native/package.json'),
);
const sourcePath = exampleRequire.resolve(
  'react-native/Libraries/Pressability/Pressability.js',
);
const code = exampleRequire('@babel/core').transformSync(
  readFileSync(sourcePath, 'utf8'),
  {
    filename: sourcePath,
    configFile: false,
    babelrc: false,
    presets: [exampleRequire.resolve('babel-preset-expo')],
  },
).code;

let measuredRect = { x: 0, y: 0, width: 96, height: 48 };
const moduleObject = { exports: {} };
function requireForPressability(name) {
  if (name.includes('FeatureFlags'))
    return new Proxy({}, { get: () => () => false });
  if (name.includes('UIManager')) {
    return {
      measure: (_target, callback) => {
        const { x, y, width, height } = measuredRect;
        callback(0, 0, width, height, x, y);
      },
    };
  }
  if (name.includes('Rect')) return { normalizeRect: (rect) => rect };
  if (name.includes('Platform')) return { OS: 'ios' };
  if (name.includes('HoverState')) return { isHoverEnabled: () => false };
  if (name.includes('PerformanceEventEmitter')) return { emitEvent: () => {} };
  if (name === 'invariant')
    return (condition, message) => {
      if (!condition) throw Error(message);
    };
  if (name.includes('SoundManager')) return { playTouchSound: () => {} };
  return reactNativeRequire(name);
}
runInNewContext(code, {
  module: moduleObject,
  exports: moduleObject.exports,
  require: requireForPressability,
  __DEV__: false,
  setTimeout,
  clearTimeout,
  Date,
  console,
  process,
});
const Pressability = moduleObject.exports.default;

function event(pageX, pageY) {
  return {
    currentTarget: 1,
    persist() {},
    nativeEvent: { pageX, pageY, changedTouches: [{ pageX, pageY }] },
  };
}

function responder(rect, callbacks = {}) {
  measuredRect = rect;
  const calls = [];
  const pressability = new Pressability({
    minPressDuration: 0,
    delayLongPress: 20,
    onPressIn: () => calls.push('in'),
    onPressOut: () => calls.push('out'),
    onPress: () => calls.push('press'),
    onLongPress: () => calls.push('long'),
    ...callbacks,
  });
  return {
    calls,
    handlers: pressability.getEventHandlers(),
    reset: () => pressability.reset(),
  };
}

test('a 1-point move keeps a projected marker press when measured coordinates match', () => {
  const matched = responder({ x: 200, y: 300, width: 96, height: 48 });
  matched.handlers.onResponderGrant(event(248, 324));
  matched.handlers.onResponderMove(event(249, 324));
  matched.handlers.onResponderRelease(event(249, 324));
  expect(matched.calls).toEqual(['in', 'out', 'press']);
  matched.reset();

  // This is the old native-only host translation: Pressability cancels on MOVE.
  const stale = responder({ x: 0, y: 0, width: 96, height: 48 });
  stale.handlers.onResponderGrant(event(248, 324));
  stale.handlers.onResponderMove(event(249, 324));
  stale.handlers.onResponderRelease(event(249, 324));
  expect(stale.calls).toEqual(['in', 'out']);
  stale.reset();
});

test('nested child and map offset use the measured page rect; leaving bounds cancels', () => {
  const nested = responder({ x: 252, y: 332, width: 72, height: 28 });
  nested.handlers.onResponderGrant(event(278, 348));
  nested.handlers.onResponderMove(event(279, 348));
  nested.handlers.onResponderRelease(event(279, 348));
  expect(nested.calls).toEqual(['in', 'out', 'press']);
  nested.reset();

  const leave = responder({ x: 252, y: 332, width: 72, height: 28 });
  leave.handlers.onResponderGrant(event(278, 348));
  leave.handlers.onResponderMove(event(450, 348));
  leave.handlers.onResponderRelease(event(450, 348));
  expect(leave.calls).toEqual(['in', 'out']);
  leave.reset();
});

test('a held projected marker emits long press', async () => {
  const held = responder({ x: 200, y: 300, width: 96, height: 48 });
  held.handlers.onResponderGrant(event(248, 324));
  await new Promise((resolve) => setTimeout(resolve, 45));
  held.handlers.onResponderRelease(event(248, 324));
  expect(held.calls).toContain('long');
  expect(held.calls).not.toContain('press');
  held.reset();
});
