import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { changeMemberRoleSchema } from '@family-ledger/contracts';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Choice } from '@/components/ui/choice';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { useActiveFamily } from '@/providers/active-family-provider';
import { useAuth } from '@/providers/auth-provider';
import { rpc } from '@/infrastructure/supabase/ledger';
import { palette, radius, spacing } from '@/constants/theme';

type AssignableRole = 'ADMIN' | 'MEMBER' | 'VIEWER';
type Member = { user_id: string; display_name: string; role: 'OWNER' | AssignableRole; status: 'ACTIVE' | 'SUSPENDED' };
const roleExplanation: Record<AssignableRole, string> = {
  ADMIN: 'Can manage accounts, categories, invitations, join requests and every transaction.',
  MEMBER: 'Can add transactions and manage transactions they created.',
  VIEWER: 'Can inspect family records and reports without changing financial data.',
};

function MemberCard({ member, familyId, currentRole, currentUserId, refresh }: { member: Member; familyId: string; currentRole: string; currentUserId?: string; refresh: () => Promise<unknown> }) {
  const [role, setRole] = useState<AssignableRole>(member.role === 'OWNER' ? 'ADMIN' : member.role); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const isSelf = member.user_id === currentUserId; const ownerCanManage = currentRole === 'OWNER' && member.role !== 'OWNER' && !isSelf; const adminCanManage = currentRole === 'ADMIN' && !isSelf && member.role !== 'OWNER' && member.role !== 'ADMIN'; const canManageStatus = ownerCanManage || adminCanManage;
  async function run(name: string, args: Record<string, unknown>) { setBusy(true); setError(''); try { await rpc(name, args); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update this member.'); } finally { setBusy(false); } }
  const saveRole = () => Alert.alert(`Make ${member.display_name} a ${role.toLowerCase()}?`, roleExplanation[role], [{ text: 'Cancel', style: 'cancel' }, { text: 'Change role', onPress: () => { const input = changeMemberRoleSchema.safeParse({ familyId, userId: member.user_id, role, idempotencyKey: Crypto.randomUUID() }); if (!input.success) { setError('Choose a valid role.'); return; } void run('change_member_role', { p_family_id: familyId, p_user_id: member.user_id, p_role: role, p_idempotency_key: input.data.idempotencyKey }); } }]);
  const changeStatus = (status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED') => Alert.alert(status === 'ACTIVE' ? 'Restore access?' : status === 'SUSPENDED' ? 'Pause this member’s access?' : 'Remove member?', status === 'SUSPENDED' ? 'They cannot open family data until access is restored.' : status === 'REMOVED' ? 'They lose access, while historical attribution remains.' : 'Their family access will become active again.', [{ text: 'Cancel', style: 'cancel' }, { text: status === 'ACTIVE' ? 'Restore' : status === 'SUSPENDED' ? 'Suspend' : 'Remove', style: status === 'ACTIVE' ? 'default' : 'destructive', onPress: () => { void run('set_family_member_status', { p_family_id: familyId, p_user_id: member.user_id, p_status: status, p_idempotency_key: Crypto.randomUUID() }); } }]);
  const transfer = () => Alert.alert('Transfer family ownership?', `${member.display_name} becomes the Owner. You remain an Admin. This protects the family from having no owner.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Transfer ownership', style: 'destructive', onPress: () => { void run('transfer_family_ownership', { p_family_id: familyId, p_new_owner_user_id: member.user_id, p_idempotency_key: Crypto.randomUUID() }); } }]);
  return <Card tone={member.status === 'SUSPENDED' ? 'expense' : member.role === 'OWNER' ? 'accent' : 'default'}><View style={styles.header}><View style={styles.avatar}><AppText style={styles.avatarText}>{member.display_name.slice(0, 2).toUpperCase()}</AppText></View><View style={styles.copy}><AppText variant="heading">{member.display_name}{isSelf ? ' (You)' : ''}</AppText><AppText muted>{member.role} · {member.status}</AppText></View></View>{member.role === 'OWNER' && <Notice message="The Owner role remains protected until it is explicitly transferred." />}{ownerCanManage && member.status === 'ACTIVE' && <><Choice label="Role" value={role} options={[{ value: 'ADMIN', label: 'Admin' }, { value: 'MEMBER', label: 'Member' }, { value: 'VIEWER', label: 'Viewer' }]} onChange={(value) => { setRole(value as AssignableRole); setError(''); }} /><AppText muted>{roleExplanation[role]}</AppText><AppButton label="Save role" loading={busy} disabled={role === member.role} onPress={saveRole} /><AppButton label="Transfer ownership" kind="secondary" disabled={busy} onPress={transfer} /></>}{canManageStatus && <>{member.status === 'ACTIVE' ? <AppButton label="Suspend access" kind="secondary" disabled={busy} onPress={() => changeStatus('SUSPENDED')} /> : <AppButton label="Restore access" disabled={busy} onPress={() => changeStatus('ACTIVE')} />}<AppButton label="Remove member" kind="destructive" disabled={busy} onPress={() => changeStatus('REMOVED')} /></>}{error && <Notice tone="danger" message={error} />}</Card>;
}

export default function MembersScreen() {
  const { activeFamily: family } = useActiveFamily(); const { user } = useAuth(); const client = useQueryClient(); const [leaving, setLeaving] = useState(false); const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['members', family?.id], queryFn: () => rpc<Member[]>('list_family_members', { p_family_id: family!.id }), enabled: !!family });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['members', family?.id] }), client.invalidateQueries({ queryKey: ['families'] })]); };
  const leave = () => family && Alert.alert('Leave this family?', 'You will immediately lose access. Your previous transaction attribution remains.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave family', style: 'destructive', onPress: async () => { setLeaving(true); setError(''); try { await rpc('leave_family', { p_family_id: family.id, p_idempotency_key: Crypto.randomUUID() }); await refresh(); router.replace('/'); } catch (cause) { setError(cause instanceof Error ? cause.message.replace('TRANSFER_OWNERSHIP_FIRST', 'Transfer ownership before leaving this family.') : 'Unable to leave.'); } finally { setLeaving(false); } } }]);
  return <Screen title="Family members" subtitle={family?.name}><QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />{error && <Notice tone="danger" message={error} />}{query.data?.map((member) => <MemberCard key={`${member.user_id}-${member.role}-${member.status}`} member={member} familyId={family!.id} currentRole={family!.role} currentUserId={user?.id} refresh={refresh} />)}{family?.role !== 'OWNER' && <Card tone="expense"><AppText variant="heading">Leave family</AppText><AppText muted>Your historical entries remain credited to you, but this family’s data becomes inaccessible.</AppText><AppButton label="Leave this family" kind="destructive" loading={leaving} onPress={leave} /></Card>}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, avatar: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: palette.actionSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: palette.action, fontWeight: '800' }, copy: { flex: 1, gap: 2 } });
