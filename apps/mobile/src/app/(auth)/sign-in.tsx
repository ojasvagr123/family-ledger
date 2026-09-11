import { useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/ui/app-button';
import { AppField } from '@/components/ui/app-field';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { requireSupabase } from '@/infrastructure/supabase/client';

export default function SignInScreen() {
  const { invited } = useLocalSearchParams<{ invited?: string }>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setError(null); setMessage(null);
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    const { error: authError } = await requireSupabase().auth.signInWithOtp({ email: clean, options: { emailRedirectTo: Linking.createURL('/auth-callback'), shouldCreateUser: true } });
    setLoading(false);
    if (authError) setError(authError.message); else setMessage('Check your email and open the secure sign-in link on this device.');
  }
  return <Screen title="Sign in" subtitle={invited ? 'Sign in first; your family invitation is saved on this device.' : 'We’ll email a secure sign-in link.'}>{message && <Notice message={message} />}{error && <Notice tone="danger" message={error} />}<AppField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><AppButton label="Email me a sign-in link" loading={loading} onPress={submit} /><AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
