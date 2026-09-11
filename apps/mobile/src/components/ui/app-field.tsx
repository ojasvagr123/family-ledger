import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { palette, radius, spacing } from '@/constants/theme';
import { AppText } from './app-text';
type Props = TextInputProps & { label: string; error?: string };
export function AppField({ label, error, style, ...props }: Props) { return <View style={styles.group}><AppText variant="caption">{label}</AppText><TextInput {...props} accessibilityLabel={label} accessibilityHint={error} placeholderTextColor={palette.textMuted} style={[styles.input, props.multiline && styles.multiline, style]} />{error && <AppText variant="caption" style={styles.error}>{error}</AppText>}</View>; }
const styles = StyleSheet.create({ group: { gap: spacing.xs }, input: { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, backgroundColor: palette.surface, color: palette.text, paddingHorizontal: spacing.md, fontSize: 16 }, multiline: { minHeight: 96, paddingVertical: spacing.md, textAlignVertical: 'top' }, error: { color: palette.destructive } });
