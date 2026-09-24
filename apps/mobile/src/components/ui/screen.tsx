import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, spacing } from '@/constants/theme';
import { AppText } from './app-text';
type Props = PropsWithChildren<{ title?: string; subtitle?: string; action?: ReactNode; scroll?: boolean }>;
export function Screen({ title, subtitle, action, scroll = true, children }: Props) {
  const content = <View style={styles.content}>{(title || subtitle || action) && <View style={styles.header}><View style={styles.headerCopy}>{subtitle && <AppText variant="eyebrow">{subtitle}</AppText>}{title && <AppText variant="title">{title}</AppText>}</View>{action}</View>}{children}</View>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, scroll: { flexGrow: 1 }, content: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 104, gap: spacing.lg }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }, headerCopy: { flex: 1, gap: spacing.xs } });
