import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { pruneDrafts } from '@/infrastructure/drafts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listFamilies } from '@/infrastructure/supabase/families';
import type { FamilySummary } from '@/infrastructure/supabase/types';
import { useAuth } from './auth-provider';

type Value = { loading: boolean; error: Error | null; retry: () => unknown; families: FamilySummary[]; activeFamily: FamilySummary | null; selectFamily: (id: string) => void };
const Context = createContext<Value>({ loading: false, error: null, retry: () => undefined, families: [], activeFamily: null, selectFamily: () => undefined });

export function ActiveFamilyProvider({ children }: PropsWithChildren) {
  const { user, configured } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['families', user?.id], queryFn: listFamilies, enabled: configured && Boolean(user), refetchInterval: 15_000 });
  const families = useMemo(() => user ? (query.data ?? []) : [], [query.data, user]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void queryClient.invalidateQueries({ queryKey: ['families'] }); });
    return () => subscription.remove();
  }, [queryClient]);
  useEffect(() => {
    const permitted = new Set(families.filter((family) => family.status === 'ACTIVE').map((family) => family.id));
    if (user && query.isSuccess) void pruneDrafts(user.id, [...permitted]).catch(() => undefined);
    queryClient.removeQueries({ predicate: (item) => item.queryKey[0] !== 'families' && typeof item.queryKey[1] === 'string' && !permitted.has(item.queryKey[1]) });
  }, [families, queryClient, user, query.isSuccess]);
  const effectiveId = activeId && families.some((family) => family.id === activeId) ? activeId : families.find((family) => family.status === 'ACTIVE')?.id ?? families[0]?.id ?? null;
  const activeFamily = families.find((family) => family.id === effectiveId) ?? null;
  const value = useMemo(() => ({ loading: query.isLoading, error: query.error, retry: query.refetch, families, activeFamily, selectFamily: (id: string) => { queryClient.removeQueries({ predicate: (item) => item.queryKey[0] !== 'families' }); setActiveId(id); } }), [activeFamily, families, query.isLoading, query.error, query.refetch, queryClient]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useActiveFamily = () => useContext(Context);
