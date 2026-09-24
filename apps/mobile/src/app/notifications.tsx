import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { rpc } from '@/infrastructure/supabase/ledger';

type Notification = { id: string; family_id: string; event_type: string; title: string; body: string; route: string | null; read_at: string | null; created_at: string };

export default function NotificationsScreen() {
  const client = useQueryClient(); const query = useQuery({ queryKey: ['notifications'], queryFn: () => rpc<Notification[]>('list_my_notifications', { p_limit: 100 }) });
  async function mark(item: Notification) { await rpc('mark_notification_read', { p_notification_id: item.id, p_read: !item.read_at }); await client.invalidateQueries({ queryKey: ['notifications'] }); }
  return <Screen title="Notifications" subtitle="Family updates"><QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />{query.data?.length === 0 && <Notice message="You are all caught up. Join requests and access changes will appear here." />}{query.data?.map((item) => <Card key={item.id} tone={item.read_at ? 'default' : 'accent'}><AppText variant="eyebrow">{item.read_at ? 'Read' : 'New'}</AppText><AppText variant="heading">{item.title}</AppText>{item.body && <AppText muted>{item.body}</AppText>}<AppText variant="caption" muted>{new Date(item.created_at).toLocaleString()}</AppText>{item.route && <AppButton label="Open" onPress={async () => { if (!item.read_at) await mark(item); router.push(item.route as never); }} />}<AppButton label={item.read_at ? 'Mark unread' : 'Mark read'} kind="secondary" onPress={() => { void mark(item); }} /></Card>)}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
