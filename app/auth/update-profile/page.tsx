'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { getRegionCode, REGIONS } from '@/lib/constants/regions';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';

export default function UpdateProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState<{
    id?: string;
    name?: string;
    role?: string;
    phone?: string;
    department?: string;
    organization?: string;
  } | null>(null);
  const [region, setRegion] = useState('');
  const [error, setError] = useState<string | null>(null);
  // React Hook은 컴포넌트 최상위 레벨에서 호출
  const { data: session, status } = useSession();

  useEffect(() => {
    loadProfile();
  }, [session, status]);

  const loadProfile = async () => {
    try {
      if (status === "loading") return;
      const user = session?.user;
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setRegion(data.region || '');
      setLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('프로필을 불러오는데 실패했습니다.');
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!region) {
      setError('지역을 선택해주세요.');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const regionCode = getRegionCode(region);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          region: region,
          region_code: regionCode,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id || '');

      if (updateError) throw updateError;

      // 성공적으로 업데이트되면 대시보드로 이동
      router.push('/dashboard');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('프로필 업데이트에 실패했습니다.');
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <GlassCard>
            <div className="text-center py-8">
              <div className="text-green-400 mb-6">
                <svg className="w-20 h-20 mx-auto animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-3">
                프로필 정보 확인 중...
              </h2>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        <GlassCard>
          <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-2">
              프로필 정보 업데이트
            </h1>
            <p className="text-gray-400 mb-6">
              시스템 사용을 위해 지역 정보를 업데이트해주세요.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                소속 지역 *
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:border-green-400 focus:ring-1 focus:ring-green-400 focus:outline-none transition-all"
                required
              >
                <option value="">지역을 선택하세요</option>
                {REGIONS.map((r) => (
                  <option key={r.code} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <NeoButton
                onClick={handleUpdate}
                disabled={updating || !region}
                fullWidth
              >
                {updating ? '업데이트 중...' : '프로필 업데이트'}
              </NeoButton>

              <NeoButton
                variant="secondary"
                onClick={() => router.push('/auth/signin')}
                disabled={updating}
                fullWidth
              >
                로그아웃
              </NeoButton>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-sm text-blue-400">
                <strong>참고:</strong> 지역 정보는 AED 데이터 조회 권한을 결정하는 중요한 정보입니다.
                정확한 소속 지역을 선택해주세요.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}