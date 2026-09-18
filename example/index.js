import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// `EXPO_PUBLIC_*` is inlined at bundle time and picks which screen renders.
// Both static `require()`s stay in Metro's dependency graph either way.
const App =
  process.env.EXPO_PUBLIC_BENCHMARK === '1'
    ? require('./benchmark/BenchmarkApp').default
    : require('./App').default;

registerRootComponent(function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
});
