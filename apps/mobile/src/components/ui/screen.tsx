import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, spacing } from '@/constants/theme';
import { AppText } from './app-text';
type Props = PropsWithChildren<{ title?: string; subtitle?: string; action?: ReactNode; scroll?: boolean }>;
export function Screen({ title, subtitle, action, scroll = true, children }: Props) {
  const content = <View style={styles.content}>{(title || subtitle || action) && <View style={styles.header}><View style={styles.headerCopy}>{title && <AppText variant="title">{title}</AppText>}{subtitle && <AppText muted>{subtitle}</AppText>}</View>{action}</View>}{children}</View>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}</KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, scroll: { flexGrow: 1 }, content: { flex: 1, padding: spacing.lg, gap: spacing.lg }, header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, headerCopy: { flex: 1, gap: spacing.xs } });
