import { useState } from 'react';
import { Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { AppButton } from '@/components/ui/app-button';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { rpc } from '@/infrastructure/supabase/ledger';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { useAuth } from '@/providers/auth-provider';

type Profile = { user_id: string; display_name: string; avatar_url: string | null; locale: string; timezone: string; updated_at: string };

function ProfileForm({ profile }: { profile: Profile }) {
  const client = useQueryClient(); const { user } = useAuth();
  const [name, setName] = useState(profile.display_name); const [avatar, setAvatar] = useState(profile.avatar_url ?? ''); const [locale, setLocale] = useState(profile.locale); const [timezone, setTimezone] = useState(profile.timezone); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function save() {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { if (!name.trim() || !locale.trim() || !timezone.trim()) throw new Error('Name, locale and timezone are required.'); await rpc<Profile>('update_my_profile', { p_display_name: name.trim(), p_avatar_url: avatar.trim() || null, p_locale: locale.trim(), p_timezone: timezone.trim(), p_idempotency_key: Crypto.randomUUID() }); await Promise.all([client.invalidateQueries({ queryKey: ['profile', user?.id] }), client.invalidateQueries({ queryKey: ['members'] })]); setMessage('Profile updated.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update profile.'); } finally { setBusy(false); }
  }
  const signOutEverywhere = () => Alert.alert('Sign out everywhere?', 'This revokes all sessions, including this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out everywhere', style: 'destructive', onPress: async () => { await requireSupabase().auth.signOut({ scope: 'global' }); router.replace('/'); } }]);
  return <>{message && <Notice message={message} />}{error && <Notice tone="danger" message={error} />}<Card><AppField label="Display name" value={name} onChangeText={setName} maxLength={80} /><AppField label="Avatar image URL (optional)" value={avatar} onChangeText={setAvatar} autoCapitalize="none" keyboardType="url" /><AppField label="Locale" value={locale} onChangeText={setLocale} autoCapitalize="none" placeholder="en-IN" /><AppField label="Timezone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" placeholder="Asia/Kolkata" /><AppButton label="Save profile" loading={busy} onPress={() => { void save(); }} /></Card><Card tone="expense"><AppText variant="heading">Session security</AppText><AppText muted>Use this if a phone is lost or another session should no longer have access.</AppText><AppButton label="Sign out on every device" kind="destructive" onPress={signOutEverywhere} /></Card></>;
}

export default function ProfileScreen() {
  const { user } = useAuth(); const query = useQuery({ queryKey: ['profile', user?.id], queryFn: () => rpc<Profile>('get_my_profile', {}), enabled: !!user });
  return <Screen title="Profile & preferences" subtitle="Your account"><QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />{query.data && <ProfileForm key={query.data.updated_at} profile={query.data} />}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
