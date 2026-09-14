import type { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useActiveFamily } from '@/providers/active-family-provider';
import { Screen } from './ui/screen';
import { AppText } from './ui/app-text';
import { QueryFeedback } from './ui/query-feedback';
import { View } from 'react-native';
import { Notice } from './ui/notice';
export function FamilyGate({ children }: PropsWithChildren) {
  const auth = useAuth(); const family = useActiveFamily();
  if (auth.loading || family.loading) return <Screen><AppText>Checking family access…</AppText></Screen>;
  if (!auth.user) return <Redirect href="/(auth)/sign-in" />;
  if (family.error && !family.activeFamily) return <Screen title="Connection unavailable"><QueryFeedback error={family.error} retry={family.retry} /></Screen>;
  if (!family.activeFamily) return <Redirect href="/(onboarding)/create-family" />;
  if (family.activeFamily.status !== 'ACTIVE') return <Redirect href="/(onboarding)/pending-approval" />;
  if (family.error) return <View style={{ flex: 1 }}><Notice tone="warning" message="Connection unavailable. Previously loaded data may be out of date. Save a local draft and retry when connected." />{children}</View>;
  return children;
}
