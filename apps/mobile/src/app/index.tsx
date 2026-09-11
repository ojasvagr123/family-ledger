import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AppText } from '@/components/ui/app-text';
import { Notice } from '@/components/ui/notice';
import { palette, spacing } from '@/constants/theme';
import { envIssues } from '@/infrastructure/env';
import { useAuth } from '@/providers/auth-provider';
import { useActiveFamily } from '@/providers/active-family-provider';
export default function Index() { const auth = useAuth(); const family = useActiveFamily(); if (!auth.configured) return <View style={styles.center}><AppText variant="title">FamilyLedger</AppText><Notice tone="warning" message="Local setup is ready. Add the EXPO_PUBLIC_SUPABASE values from .env.example to connect a backend." />{envIssues.map((issue) => <AppText key={issue} variant="caption" muted>{issue}</AppText>)}</View>; if (auth.loading || (auth.user && family.loading)) return <View style={styles.center}><ActivityIndicator color={palette.action} /><AppText muted>Opening your ledger…</AppText></View>; if (!auth.user) return <Redirect href="/(auth)/welcome" />; if (!family.activeFamily) return <Redirect href="/(onboarding)/create-family" />; if (family.activeFamily.status === 'PENDING') return <Redirect href="/(onboarding)/pending-approval" />; return <Redirect href="/(tabs)/home" />; }
const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: palette.canvas } });
