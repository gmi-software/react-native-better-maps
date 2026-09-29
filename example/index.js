import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';
import MarkerViewBenchmark from './marker-view-benchmark/MarkerViewBenchmark';
import MarkerTouchCheck from './marker-view-benchmark/MarkerTouchCheck';

const RootApp =
  process.env.EXPO_PUBLIC_MARKER_TOUCH_CHECK === '1'
    ? MarkerTouchCheck
    : process.env.EXPO_PUBLIC_MARKER_VIEW_BENCHMARK === '1'
      ? MarkerViewBenchmark
      : App;

registerRootComponent(function Root() {
  return (
    <SafeAreaProvider>
      <RootApp />
    </SafeAreaProvider>
  );
});
