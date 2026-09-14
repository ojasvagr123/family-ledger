import { useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/ui/app-button';
import { AppField } from '@/components/ui/app-field';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { getPendingInvite } from '@/infrastructure/deep-links/pending-invite';

export default function SignInScreen() {
  const { invited } = useLocalSearchParams<{ invited?: string }>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  async function submit() {
    setError(null); setMessage(null);
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await requireSupabase().auth.signInWithOtp({ email: clean, options: { emailRedirectTo: Linking.createURL('/auth-callback'), shouldCreateUser: true } });
      if (authError) throw authError;
      setSentEmail(clean); setMessage('Check your email. Open the sign-in link on this device, or enter the code from the email below.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send email. Check your connection.'); } finally { setLoading(false); }
  }
  async function verify() {
    if (!/^\d{6,10}$/.test(code.trim())) { setError('Enter the code from your email.'); return; }
    setLoading(true); setError(null);
    try { const result = await requireSupabase().auth.verifyOtp({ email: sentEmail, token: code.trim(), type: 'email' }); if (result.error) throw result.error; const token = await getPendingInvite(); router.replace(token ? { pathname: '/(onboarding)/accept-invite', params: { token } } : '/'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to verify. Request a new code.'); } finally { setLoading(false); }
  }
  return <Screen title="Sign in" subtitle={invited ? 'Sign in first; your family invitation is saved on this device.' : 'We’ll email a secure sign-in link.'}>{message && <Notice message={message} />}{error && <Notice tone="danger" message={error} />}<AppField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><AppButton label="Email me a sign-in link" loading={loading} onPress={submit} />{sentEmail && <><AppField label="Email verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" /><AppButton label="Verify code" loading={loading} onPress={verify} /></>}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
