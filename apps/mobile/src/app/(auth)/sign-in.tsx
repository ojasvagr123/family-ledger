import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/ui/app-button';
import { AppField } from '@/components/ui/app-field';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { getPendingInvite } from '@/infrastructure/deep-links/pending-invite';
import { env } from '@/infrastructure/env';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { palette, radius, spacing } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { invited } = useLocalSearchParams<{ invited?: string }>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  async function social(provider: 'google' | 'apple') {
    setLoading(true); setError(null); setMessage(null);
    try {
      const redirectTo = Linking.createURL('/auth-callback');
      const { data, error: authError } = await requireSupabase().auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
      if (authError) throw authError; if (!data.url) throw new Error('The identity provider did not return a sign-in URL.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;
      const code = new URL(result.url).searchParams.get('code'); if (!code) throw new Error('The provider response was incomplete.');
      const exchanged = await requireSupabase().auth.exchangeCodeForSession(code); if (exchanged.error) throw exchanged.error;
      const token = await getPendingInvite(); router.replace(token ? { pathname: '/(onboarding)/accept-invite', params: { token } } : '/');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to complete social sign-in.'); } finally { setLoading(false); }
  }
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
  return <Screen title="Welcome back" subtitle="Secure sign in"><View style={styles.brand}><View style={styles.logo}><AppText style={styles.logoText}>FL</AppText></View><AppText variant="heading">FamilyLedger</AppText><AppText muted>{invited ? 'Your family invitation is saved. Sign in to continue.' : 'One shared view for the money your family manages together.'}</AppText></View>{message && <Notice message={message} />}{error && <Notice tone="danger" message={error} />}{env?.enableSocialAuth && <Card><AppButton label="Continue with Google" kind="secondary" loading={loading} onPress={() => { void social('google'); }} />{Platform.OS === 'ios' && <AppButton label="Continue with Apple" kind="secondary" loading={loading} onPress={() => { void social('apple'); }} />}<View style={styles.divider}><View style={styles.line} /><AppText variant="caption" muted>or use email</AppText><View style={styles.line} /></View><AppField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><AppButton label="Email me a sign-in link" loading={loading} onPress={submit} /></Card>}{!env?.enableSocialAuth && <Card><AppField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><AppButton label="Email me a sign-in link" loading={loading} onPress={submit} /></Card>}{sentEmail && <Card tone="accent"><AppText variant="heading">Enter your email code</AppText><AppText muted>Or open the secure link in the same device.</AppText><AppField label="Email verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" /><AppButton label="Verify code" loading={loading} onPress={verify} /></Card>}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
const styles = StyleSheet.create({ brand: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }, logo: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: palette.action, alignItems: 'center', justifyContent: 'center' }, logoText: { color: palette.white, fontSize: 22, fontWeight: '900' }, divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, line: { flex: 1, height: 1, backgroundColor: palette.border } });
