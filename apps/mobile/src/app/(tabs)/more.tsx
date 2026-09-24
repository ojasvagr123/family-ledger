import { Alert, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { ActionRow } from '@/components/ui/action-row';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { useActiveFamily } from '@/providers/active-family-provider';
import { palette, radius, spacing } from '@/constants/theme';

export default function MoreScreen() {
  const { activeFamily, families, selectFamily } = useActiveFamily();
  const canManage = activeFamily?.role === 'OWNER' || activeFamily?.role === 'ADMIN';
  const signOut = (global = false) => Alert.alert(global ? 'Sign out everywhere?' : 'Sign out?', global ? 'All sessions for this account will be revoked.' : 'This device will return to the sign-in screen.', [
    { text: 'Cancel', style: 'cancel' },
    { text: global ? 'Sign out everywhere' : 'Sign out', style: 'destructive', onPress: async () => { await requireSupabase().auth.signOut({ scope: global ? 'global' : 'local' }); router.replace('/'); } },
  ]);
  return <Screen title="Your space" subtitle={activeFamily?.name ?? 'FamilyLedger'}>
    <Card tone="accent"><View style={styles.familyHeader}><View style={styles.avatar}><AppText style={styles.avatarText}>{activeFamily?.name?.slice(0, 2).toUpperCase() ?? 'FL'}</AppText></View><View style={styles.familyCopy}><AppText variant="heading">{activeFamily?.name}</AppText><AppText muted>{activeFamily?.role?.replaceAll('_', ' ')} · {activeFamily?.currency_code}</AppText></View></View></Card>
    <View><AppText variant="eyebrow" style={styles.groupTitle}>Money management</AppText><Card style={styles.menu}><ActionRow title="Accounts" detail="Balances, reconciliation and transfers" symbol="◉" onPress={() => router.push('/accounts')} /><ActionRow title="Import CSV" detail="Bring transactions from your bank" symbol="⇩" onPress={() => router.push('/imports/csv')} /><ActionRow title="Transaction trash" detail="Restore recently deleted entries" symbol="⌫" onPress={() => router.push('/transactions/trash' as Href)} /></Card></View>
    <View><AppText variant="eyebrow" style={styles.groupTitle}>Family</AppText><Card style={styles.menu}>{canManage && <ActionRow title="Family settings" detail="Currency, calendar and household notes" symbol="⚙" onPress={() => router.push('/settings/family' as Href)} />}{canManage && <ActionRow title="Categories" detail="Rename, reorder, archive and restore" symbol="⌗" onPress={() => router.push('/settings/categories')} />}<ActionRow title="Members" detail="Roles, access and ownership" symbol="◎" onPress={() => router.push('/family/members')} />{canManage && <ActionRow title="Invitation links" detail="Invite someone securely" symbol="↗" onPress={() => router.push('/family/invitations')} />}{canManage && <ActionRow title="Join requests" detail="Approve or reject new members" symbol="✓" onPress={() => router.push('/family/join-requests')} />}<ActionRow title="Accept invitation" detail="Join another family" symbol="＋" onPress={() => router.push('/(onboarding)/accept-invite')} /></Card></View>
    {families.some((family) => family.id !== activeFamily?.id) && <View><AppText variant="eyebrow" style={styles.groupTitle}>Switch family</AppText><Card style={styles.menu}>{families.map((family) => family.id !== activeFamily?.id && <ActionRow key={family.id} title={family.name} detail={`${family.role} · ${family.currency_code}`} symbol={family.name.slice(0, 1).toUpperCase()} onPress={() => selectFamily(family.id)} />)}</Card></View>}
    <View><AppText variant="eyebrow" style={styles.groupTitle}>Account</AppText><Card style={styles.menu}><ActionRow title="Notifications" detail="Join requests and access updates" symbol="◌" onPress={() => router.push('/notifications' as Href)} /><ActionRow title="Profile & preferences" detail="Name, locale, timezone and sessions" symbol="☺" onPress={() => router.push('/settings/profile' as Href)} /><ActionRow title="Help & FAQs" detail="Learn reports, roles and imports" symbol="?" onPress={() => router.push('/help')} /><ActionRow title="Sign out this device" symbol="←" onPress={() => signOut(false)} /><ActionRow title="Sign out everywhere" detail="Revoke all active sessions" symbol="×" destructive onPress={() => signOut(true)} /></Card></View>
  </Screen>;
}

const styles = StyleSheet.create({ familyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, avatar: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: palette.action, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: palette.white, fontSize: 18, fontWeight: '800' }, familyCopy: { flex: 1, gap: 2 }, groupTitle: { marginLeft: spacing.xs, marginBottom: spacing.sm }, menu: { padding: 0, gap: 0, overflow: 'hidden' } });
