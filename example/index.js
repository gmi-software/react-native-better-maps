import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// `EXPO_PUBLIC_*` variables are inlined at bundle time, so the demo bundle
// never includes the harness unless it was built with the flag set.
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
