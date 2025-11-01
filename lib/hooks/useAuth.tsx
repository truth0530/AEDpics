'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
// TODO: Supabase 클라이언트 임시 비활성화 - NextAuth로 전환 필요
// import { createClient } // TODO: Supabase 클라이언트 임시 비활성화
// from '@/lib/supabase/client';
// import { User } from '@supabase/supabase-js';
import { UserProfile } from '@/packages/types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // TODO: NextAuth useSession으로 전환 필요
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false); // Always not loading for now
  const [error, setError] = useState<string | null>(null);

  // TODO: Temporary stub - implement with NextAuth
  useEffect(() => {
    logger.warn('AuthProvider:Temporary', 'AuthProvider is temporarily disabled - needs NextAuth migration');
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );

  /* TODO: 아래 코드는 Supabase 의존성 제거 후 재활성화
  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select(`
              *,
              organizations (
                id,
                name,
                type,
                region_code,
                city_code
              )
            `)
            .eq('id', authUser.id)
            .single();

          if (profile) {
            // Flatten organization data
            const userProfile: UserProfile = {
              ...profile,
              organization: profile.organizations || null
            } as UserProfile;

            console.log('[useAuth] User loaded successfully:', {
              authUserId: authUser.id,
              profileId: profile.id,
              idMatch: authUser.id === profile.id,
              userProfileId: userProfile.id,
              fullProfile: userProfile,
            });

            setUser(userProfile);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
  */
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}