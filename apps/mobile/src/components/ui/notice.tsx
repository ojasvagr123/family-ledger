import { StyleSheet, View } from 'react-native';
import { palette, radius, spacing } from '@/constants/theme';
import { AppText } from './app-text';
export function Notice({ message, tone = 'info' }: { message: string; tone?: 'info' | 'warning' | 'danger' }) { return <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={[styles.base, styles[tone]]}><AppText>{message}</AppText></View>; }
const styles = StyleSheet.create({ base: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 }, info: { backgroundColor: palette.actionSoft, borderColor: '#D8D8FF' }, warning: { backgroundColor: palette.warning, borderColor: '#F4DC8B' }, danger: { backgroundColor: palette.danger, borderColor: '#F6B9B4' } });
