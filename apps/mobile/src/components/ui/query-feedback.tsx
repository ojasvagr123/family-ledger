import { ActivityIndicator } from 'react-native';
import { Notice } from './notice';
import { AppButton } from './app-button';
export function QueryFeedback({ pending, error, retry }: { pending?: boolean; error?: Error | null; retry: () => unknown }) {
  if (pending) return <ActivityIndicator accessibilityLabel="Loading" />;
  if (!error) return null;
  return <><Notice tone="danger" message={`Unable to load current data. Check your connection. ${error.message}`} /><AppButton label="Retry" kind="secondary" onPress={() => { void retry(); }} /></>;
}
