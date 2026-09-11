import { Text, type TextProps, StyleSheet } from 'react-native';
import { fonts, palette } from '@/constants/theme';
type Props = TextProps & { variant?: 'body' | 'caption' | 'title' | 'heading' | 'amount'; muted?: boolean };
export function AppText({ variant = 'body', muted, style, ...props }: Props) { return <Text {...props} style={[styles.base, styles[variant], muted && styles.muted, style]} />; }
const styles = StyleSheet.create({ base: { color: palette.text, fontFamily: fonts }, body: { fontSize: 16, lineHeight: 23 }, caption: { fontSize: 13, lineHeight: 18 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '700' }, heading: { fontSize: 19, lineHeight: 25, fontWeight: '700' }, amount: { fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }, muted: { color: palette.textMuted } });
