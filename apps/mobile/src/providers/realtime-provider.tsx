import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { useActiveFamily } from './active-family-provider';

const tables = ['transactions', 'accounts', 'categories', 'family_members', 'join_requests', 'notifications'] as const;

export function RealtimeProvider({ children }: PropsWithChildren) {
  const { activeFamily } = useActiveFamily(); const client = useQueryClient();
  useEffect(() => {
    if (!supabase || !activeFamily || activeFamily.status !== 'ACTIVE') return;
    const realtimeClient = supabase; let channel = realtimeClient.channel(`family:${activeFamily.id}`);
    for (const table of tables) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${activeFamily.id}` }, () => { void client.invalidateQueries({ predicate: (query) => query.queryKey.includes(activeFamily.id) || query.queryKey[0] === 'notifications' || query.queryKey[0] === 'families' }); });
    channel.subscribe();
    return () => { void realtimeClient.removeChannel(channel); };
  }, [activeFamily, client]);
  return children;
}
