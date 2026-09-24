import { useEffect, useState, useRef } from 'react';
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
import { rpc } from '@/infrastructure/supabase/ledger';

export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<{ status: string; familyName?: string; inviterName?: string; expiresAt?: string; usesRemaining?: number } | null>(null);
  const request = useRef<{ token: string; key: string } | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  useEffect(() => {
    if (params.token) { void savePendingInvite(params.token); return; }
    void getPendingInvite().then((saved) => { if (saved) setToken(saved); });
  }, [params.token]);
  async function submit() {
    if (loading) return;
    if (!user) { await savePendingInvite(token.trim()); router.replace({ pathname: '/(auth)/sign-in', params: { invited: '1' } }); return; }
    const clean = token.trim().includes('/invite/') ? token.trim().split('/invite/')[1].split(/[?#]/)[0] : token.trim();
    const idempotencyKey = request.current?.token === clean ? request.current.key : Crypto.randomUUID(); request.current = { token: clean, key: idempotencyKey };
    const parsed = requestJoinSchema.safeParse({ token: clean, idempotencyKey });
    if (!parsed.success) { setError('Enter the complete invitation token.'); return; }
    setLoading(true); setError(null);
    try {
      await requestJoin(parsed.data); await clearPendingInvite();
      await queryClient.invalidateQueries({ queryKey: ['families', user.id] });
      router.replace('/(onboarding)/pending-approval');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request access.'); }
    finally { setLoading(false); }
  }
  async function inspect() {
    setLoading(true); setError(null);
    try { const clean = token.trim().includes('/invite/') ? token.trim().split('/invite/')[1].split(/[?#]/)[0] : token.trim(); const result = await rpc<{ status: string; familyName?: string; inviterName?: string; expiresAt?: string; usesRemaining?: number }>('inspect_invitation', { p_token: clean }); setInspection(result); } catch { setError('Unable to check invitation. Sign in and check your connection.'); } finally { setLoading(false); }
  }
  return <Screen title="Join a family" subtitle="Invitation approval">{error && <Notice tone="danger" message={error} />}{inspection && <Notice tone={inspection.status === 'VALID' ? 'info' : 'warning'} message={inspection.status === 'VALID' ? `${inspection.inviterName ?? 'A family member'} invited you to ${inspection.familyName ?? 'this family'}. The link expires ${inspection.expiresAt ? new Date(inspection.expiresAt).toLocaleString() : 'soon'}.` : `Invitation status: ${inspection.status.replaceAll('_', ' ')}`} />}<AppField label="Invitation link or token" value={token} onChangeText={(value) => { setToken(value); setInspection(null); }} autoCapitalize="none" autoCorrect={false} multiline />{user && <AppButton label="Check invitation" kind="secondary" loading={loading} onPress={inspect} />}<AppButton label={user ? 'Request access' : 'Sign in to continue'} loading={loading} disabled={inspection !== null && inspection.status !== 'VALID'} onPress={submit} /><AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
