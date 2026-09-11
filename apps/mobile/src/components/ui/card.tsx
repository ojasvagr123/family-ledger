import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { palette, radius, spacing } from '@/constants/theme';
export function Card({ style, ...props }: PropsWithChildren<ViewProps>) { return <View {...props} style={[styles.card, style]} />; }
const styles = StyleSheet.create({ card: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md } });
