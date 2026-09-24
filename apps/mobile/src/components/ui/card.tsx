import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { elevation, palette, radius, spacing } from '@/constants/theme';
type Props = PropsWithChildren<ViewProps & { tone?: 'default' | 'accent' | 'income' | 'expense'; compact?: boolean }>;
export function Card({ style, tone = 'default', compact, ...props }: Props) { return <View {...props} style={[styles.card, styles[tone], compact && styles.compact, style]} />; }
const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...elevation.card },
  compact: { padding: spacing.md, gap: spacing.sm },
  default: {}, accent: { backgroundColor: palette.actionSoft, borderColor: '#D8D8FF' },
  income: { backgroundColor: palette.income, borderColor: '#CDEEDF' }, expense: { backgroundColor: palette.expense, borderColor: '#FFD7D1' },
});
