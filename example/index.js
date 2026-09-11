import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';
import MarkerViewBenchmark from './marker-view-benchmark/MarkerViewBenchmark';

const RootApp =
  process.env.EXPO_PUBLIC_MARKER_VIEW_BENCHMARK === '1'
    ? MarkerViewBenchmark
    : App;

registerRootComponent(function Root() {
  return (
    <SafeAreaProvider>
      <RootApp />
    </SafeAreaProvider>
  );
});
