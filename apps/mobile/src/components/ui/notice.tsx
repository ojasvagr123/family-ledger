import { StyleSheet, View } from 'react-native';
import { palette, radius, spacing } from '@/constants/theme';
import { AppText } from './app-text';
export function Notice({ message, tone = 'info' }: { message: string; tone?: 'info' | 'warning' | 'danger' }) { return <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={[styles.base, styles[tone]]}><AppText>{message}</AppText></View>; }
const styles = StyleSheet.create({ base: { padding: spacing.md, borderRadius: radius.sm }, info: { backgroundColor: palette.income }, warning: { backgroundColor: palette.warning }, danger: { backgroundColor: palette.danger } });
