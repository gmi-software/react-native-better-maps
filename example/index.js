import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// `EXPO_PUBLIC_*` variables are inlined at bundle time, so the demo bundle
// never includes the performance lab unless it was built with the flag set.
// See performance/README.md.
const App =
  process.env.EXPO_PUBLIC_PERF_LAB === '1'
    ? require('../performance/app/PerfLabApp').default
    : require('./App').default;

registerRootComponent(function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
});
