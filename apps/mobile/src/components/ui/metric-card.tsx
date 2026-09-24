import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './app-text';
import { palette, radius, spacing } from '@/constants/theme';

export function MetricCard({ label, value, detail, tone = 'neutral', style }: { label: string; value: string; detail?: string; tone?: 'neutral' | 'accent' | 'income' | 'expense'; style?: ViewStyle }) {
  return <View accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ''}`} style={[styles.base, styles[tone], style]}><AppText variant="eyebrow" style={tone === 'accent' ? styles.accentLabel : undefined}>{label}</AppText><AppText variant="amount" style={tone === 'accent' ? styles.accentText : undefined}>{value}</AppText>{detail && <AppText variant="caption" muted={tone !== 'accent'} style={tone === 'accent' ? styles.accentDetail : undefined}>{detail}</AppText>}</View>;
}

const styles = StyleSheet.create({
  base: { minWidth: 150, flex: 1, padding: spacing.lg, gap: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  neutral: {}, accent: { backgroundColor: palette.navy, borderColor: palette.navy },
  income: { backgroundColor: palette.income, borderColor: '#CDEEDF' }, expense: { backgroundColor: palette.expense, borderColor: '#FFD7D1' },
  accentLabel: { color: '#B8C7E8' }, accentText: { color: palette.white }, accentDetail: { color: '#D7E0F2' },
});
