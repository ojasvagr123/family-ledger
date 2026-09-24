import { Text, type TextProps, StyleSheet } from 'react-native';
import { fonts, palette } from '@/constants/theme';
type Props = TextProps & { variant?: 'body' | 'caption' | 'eyebrow' | 'title' | 'display' | 'heading' | 'amount'; muted?: boolean };
export function AppText({ variant = 'body', muted, style, ...props }: Props) { return <Text {...props} style={[styles.base, styles[variant], muted && styles.muted, style]} />; }
const styles = StyleSheet.create({
  base: { color: palette.text, fontFamily: fonts },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 18 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: palette.action },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.6 },
  display: { fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  amount: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  muted: { color: palette.textMuted },
});
