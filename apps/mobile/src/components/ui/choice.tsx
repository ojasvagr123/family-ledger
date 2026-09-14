import { ScrollView, View } from 'react-native';
import { AppButton } from './app-button';
import { AppText } from './app-text';
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <View style={{ gap: 8 }}><AppText variant="caption">{label}</AppText><ScrollView horizontal showsHorizontalScrollIndicator><View style={{ flexDirection: 'row', gap: 8 }}>{options.map((option) => <AppButton key={option.value} label={`${option.value === value ? '✓ ' : ''}${option.label}`} kind={option.value === value ? 'primary' : 'secondary'} onPress={() => onChange(option.value)} />)}</View></ScrollView></View>;
}
