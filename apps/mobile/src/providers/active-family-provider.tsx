import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listFamilies } from '@/infrastructure/supabase/families';
import type { FamilySummary } from '@/infrastructure/supabase/types';
import { useAuth } from './auth-provider';

type Value = { loading: boolean; families: FamilySummary[]; activeFamily: FamilySummary | null; selectFamily: (id: string) => void };
const Context = createContext<Value>({ loading: false, families: [], activeFamily: null, selectFamily: () => undefined });

export function ActiveFamilyProvider({ children }: PropsWithChildren) {
  const { user, configured } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['families', user?.id], queryFn: listFamilies, enabled: configured && Boolean(user) });
  const families = useMemo(() => user ? (query.data ?? []) : [], [query.data, user]);
  const effectiveId = activeId && families.some((family) => family.id === activeId) ? activeId : families.find((family) => family.status === 'ACTIVE')?.id ?? families[0]?.id ?? null;
  const activeFamily = families.find((family) => family.id === effectiveId) ?? null;
  const value = useMemo(() => ({ loading: query.isLoading, families, activeFamily, selectFamily: (id: string) => { queryClient.removeQueries({ predicate: (item) => item.queryKey[0] !== 'families' }); setActiveId(id); } }), [activeFamily, families, query.isLoading, queryClient]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useActiveFamily = () => useContext(Context);
