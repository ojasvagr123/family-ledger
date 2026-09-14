import type { Session, User } from '@supabase/supabase-js';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { clearDrafts } from '@/infrastructure/drafts';

type AuthState = { loading: boolean; configured: boolean; session: Session | null; user: User | null };
const AuthContext = createContext<AuthState>({ loading: true, configured: false, session: null, user: null });

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); }).catch(() => { setSession(null); }).finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) { queryClient.clear(); void clearDrafts().catch(() => undefined); } });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  const value = useMemo(() => ({ loading, configured: Boolean(supabase), session, user: session?.user ?? null }), [loading, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
