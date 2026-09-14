import { useEffect, useState, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui/app-text';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { getPendingInvite } from '@/infrastructure/deep-links/pending-invite';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { AppButton } from '@/components/ui/app-button';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string; code?: string }>();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const client = requireSupabase();
        if (params.code) {
          const result = await client.auth.exchangeCodeForSession(params.code);
          if (result.error) throw result.error;
        } else if (params.token_hash) {
          const result = await client.auth.verifyOtp({ token_hash: params.token_hash, type: (params.type as 'email') ?? 'email' });
          if (result.error) throw result.error;
        } else throw new Error('The sign-in link is incomplete.');
        const token = await getPendingInvite();
        router.replace(token ? { pathname: '/(onboarding)/accept-invite', params: { token } } : '/');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to complete sign in.');
      }
    })();
  }, [params.code, params.token_hash, params.type]);
  return <Screen title="Signing you in">{error ? <><Notice tone="danger" message={error} /><AppButton label="Request a new sign-in email" onPress={() => router.replace('/(auth)/sign-in')} /></> : <AppText muted>Verifying your secure link…</AppText>}</Screen>;
}
