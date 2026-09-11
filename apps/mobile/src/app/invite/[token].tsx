import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui/app-text';
import { Screen } from '@/components/ui/screen';
import { savePendingInvite } from '@/infrastructure/deep-links/pending-invite';
import { useAuth } from '@/providers/auth-provider';

export default function InviteDeepLinkScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { loading, user } = useAuth();
  useEffect(() => {
    if (loading || !token) return;
    void savePendingInvite(token).then(() => user
      ? router.replace({ pathname: '/(onboarding)/accept-invite', params: { token } })
      : router.replace({ pathname: '/(auth)/sign-in', params: { invited: '1' } }));
  }, [loading, token, user]);
  return <Screen title="Opening invitation"><AppText muted>Securing your invitation link…</AppText></Screen>;
}
