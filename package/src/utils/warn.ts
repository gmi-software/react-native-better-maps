export function createWarn(scope: string): (message: string) => void {
  return (message: string) => {
    if ((globalThis as { __DEV__?: boolean }).__DEV__ !== true) {
      return;
    }

    console.warn(`[react-native-better-maps] ${scope}: ${message}`);
  };
}
