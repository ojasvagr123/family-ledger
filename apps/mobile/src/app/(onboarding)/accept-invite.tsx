import { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { requestJoinSchema } from '@family-ledger/contracts';
import { AppButton } from '@/components/ui/app-button';
import { AppField } from '@/components/ui/app-field';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { clearPendingInvite, getPendingInvite, savePendingInvite } from '@/infrastructure/deep-links/pending-invite';
import { requestJoin } from '@/infrastructure/supabase/families';
import { useAuth } from '@/providers/auth-provider';

export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  useEffect(() => {
    if (params.token) { void savePendingInvite(params.token); return; }
    void getPendingInvite().then((saved) => { if (saved) setToken(saved); });
  }, [params.token]);
  async function submit() {
    if (!user) { await savePendingInvite(token.trim()); router.replace({ pathname: '/(auth)/sign-in', params: { invited: '1' } }); return; }
    const parsed = requestJoinSchema.safeParse({ token: token.trim(), idempotencyKey: Crypto.randomUUID() });
    if (!parsed.success) { setError('Enter the complete invitation token.'); return; }
    setLoading(true); setError(null);
    try {
      await requestJoin(parsed.data); await clearPendingInvite();
      await queryClient.invalidateQueries({ queryKey: ['families', user.id] });
      router.replace('/(onboarding)/pending-approval');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request access.'); }
    finally { setLoading(false); }
  }
  return <Screen title="Join a family" subtitle="Joining creates a pending request. No financial data is visible until approval.">{error && <Notice tone="danger" message={error} />}<AppField label="Invitation token" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} multiline /><AppButton label={user ? 'Request access' : 'Sign in to continue'} loading={loading} onPress={submit} /><AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
