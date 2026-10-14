import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';

registerRootComponent(function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
});
