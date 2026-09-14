import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { useActiveFamily } from '@/providers/active-family-provider';
import { rpc } from '@/infrastructure/supabase/ledger';
export default function MembersScreen() {
  const { activeFamily: family } = useActiveFamily(); const client = useQueryClient();
  const query = useQuery({ queryKey: ['members', family?.id], queryFn: () => rpc<{ user_id: string; display_name: string; role: string }[]>('list_family_members', { p_family_id: family!.id }), enabled: !!family });
  return <Screen title="Family members" subtitle={family?.name}><QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />{query.data?.map((member) => <Card key={member.user_id}><AppText variant="heading">{member.display_name}</AppText><AppText>{member.role}</AppText>{family?.role === 'OWNER' && member.role !== 'OWNER' && <AppButton label="Remove member" kind="destructive" onPress={() => Alert.alert('Remove member?', 'They will lose access to this family. Their past transactions remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void rpc('remove_family_member', { p_family_id: family.id, p_user_id: member.user_id, p_idempotency_key: Crypto.randomUUID() }).then(() => client.invalidateQueries({ queryKey: ['members', family.id] })).catch(() => Alert.alert('Unable to remove', 'Refresh and try again.')); } }])} />}</Card>)}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
