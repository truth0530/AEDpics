'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';
import { ErrorDisplay } from '@/components/ui/error-display';
import { getErrorMessage, logError } from '@/lib/utils/error-handler';
import { UserRole } from '@/packages/types';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: UserRole;
  organizations?: {
    name: string;
    type: string;
    address: string;
  };
  region?: string;
  department?: string;
  created_at: string;
  last_login_at?: string;
  login_count?: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 수정 폼 데이터
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    department: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    loadProfile();
   
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/signin');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          organizations:organization_id (*)
        `)
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      console.log('[DEBUG] Profile data loaded:', {
        full_name: profileData.full_name,
        phone: profileData.phone,
        region: profileData.region,
        department: profileData.department,
        organization_id: profileData.organization_id,
        organizations: profileData.organizations
      });

      setProfile(profileData);
      setFormData({
        name: profileData.full_name || '',
        phone: profileData.phone || '',
        department: profileData.department || '',
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (err) {
      logError(err, 'loadProfile');
      const errorInfo = getErrorMessage(err);
      setError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 프로필 정보 업데이트
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.name,
          phone: formData.phone,
          department: formData.department,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      // 비밀번호 변경 (입력된 경우만)
      if (formData.new_password) {
        // 현재 비밀번호 확인 필수
        if (!formData.current_password) {
          throw new Error('현재 비밀번호를 입력해주세요.');
        }

        if (formData.new_password !== formData.confirm_password) {
          throw new Error('새 비밀번호가 일치하지 않습니다.');
        }

        if (formData.new_password.length < 6) {
          throw new Error('새 비밀번호는 6자 이상이어야 합니다.');
        }

        // 현재 비밀번호 검증
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: profile?.email || '',
          password: formData.current_password
        });

        if (signInError) {
          throw new Error('현재 비밀번호가 일치하지 않습니다.');
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.new_password
        });

        if (passwordError) throw passwordError;
      }

      setSuccess('프로필이 성공적으로 업데이트되었습니다.');
      setEditMode(false);
      await loadProfile();

      // 비밀번호 필드 초기화
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));

      // 3초 후 성공 메시지 자동 제거
      setTimeout(() => setSuccess(null), 3000);
     
    } catch (err: any) {
      logError(err, 'handleSave');
      const errorInfo = getErrorMessage(err);
      setError(errorInfo.message);
    } finally {
      setSaving(false);
    }
  };

  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return '';
    // 숫자만 추출
    const numbers = phone.replace(/[^\d]/g, '');
    // 010-1234-5678 형식으로 변환
    if (numbers.length === 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
    if (numbers.length === 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    }
    return phone;
  };

  const getRoleName = (role: UserRole) => {
    const roleNames: Partial<Record<UserRole, string>> = {
      master: '마스터',
      emergency_center_admin: '응급센터 관리자',
      ministry_admin: '복지부 관리자',
      regional_admin: '시도 관리자',
      local_admin: '보건소 관리자',
      pending_approval: '승인 대기',
      email_verified: '이메일 인증됨',
      temporary_inspector: '임시 점검자'
    };
    return roleNames[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="p-3 md:p-6 max-w-5xl mx-auto">
        {/* 헤더 - 모바일 최적화 */}
        <div className="mb-3 md:mb-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden md:inline">대시보드로 돌아가기</span>
            <span className="md:hidden">뒤로</span>
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 md:p-6">
            {/* 타이틀 - 모바일 최적화 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white">내 프로필</h1>
              <div className="flex flex-row items-center gap-2">
                <button
                  onClick={() => router.push('/profile/history')}
                  className="text-xs md:text-sm text-gray-400 hover:text-white underline"
                >
                  이력
                </button>
                {!editMode && profile?.role !== 'pending_approval' && (
                  <NeoButton onClick={() => setEditMode(true)} variant="secondary" className="text-sm py-1.5 px-3">
                    수정
                  </NeoButton>
                )}
              </div>
            </div>

            {/* 알림 메시지 */}
            {error && (
              <ErrorDisplay
                error={error}
                onDismiss={() => setError(null)}
                className="mb-4"
              />
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            {/* 승인 대기 상태 알림 */}
            {profile?.role === 'pending_approval' && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  승인 대기 중입니다. 일부 정보만 수정 가능합니다.
                </p>
              </div>
            )}

            {/* 프로필 정보 */}
            <div className="space-y-4 md:space-y-5">
              {/* 기본 정보 */}
              <div>
                <h2 className="text-base md:text-lg font-semibold text-white mb-3">기본 정보</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">이름</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-sm"
                        disabled={profile?.role === 'pending_approval'}
                      />
                    ) : (
                      <div className="py-2">
                        <p className="text-white text-sm">{profile?.full_name || '미입력'}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">이메일</label>
                    <div className="py-2">
                      <p className="text-white text-sm break-all">{profile?.email}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">연락처</label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-sm"
                      />
                    ) : (
                      <div className="py-2">
                        <p className="text-white text-sm">{formatPhoneNumber(profile?.phone) || '-'}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">역할</label>
                    <div className="py-2">
                      <p className="text-white text-sm">{getRoleName(profile?.role as UserRole)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 소속 정보 */}
              <div>
                <div className="flex flex-row items-center justify-between mb-3">
                  <h2 className="text-base md:text-lg font-semibold text-white">소속 정보</h2>
                  {!editMode && profile?.role !== 'pending_approval' && (
                    <button
                      onClick={() => router.push('/profile/change-organization')}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      변경 요청
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">지역</label>
                    <div className="py-2">
                      <p className="text-white text-sm">{profile?.region || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">소속 기관</label>
                    <div className="py-2">
                      <p className="text-white text-sm break-words">{profile?.organizations?.name || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">부서</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-sm"
                      />
                    ) : (
                      <div className="py-2">
                        <p className="text-white text-sm">{profile?.department || '-'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 비밀번호 변경 (수정 모드에서만) */}
              {editMode && profile?.role !== 'pending_approval' && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">비밀번호 변경</h2>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                    <p className="text-yellow-400 text-sm">
                      비밀번호 변경 시 현재 비밀번호 확인이 필요합니다. 보안을 위해 비어두면 변경되지 않습니다.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">현재 비밀번호 *</label>
                      <input
                        type="password"
                        value={formData.current_password}
                        onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                        className="w-full px-3 py-3 md:px-4 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-base"
                        placeholder="현재 비밀번호를 입력하세요"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">새 비밀번호</label>
                      <input
                        type="password"
                        value={formData.new_password}
                        onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                        className="w-full px-3 py-3 md:px-4 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-base"
                        placeholder="새 비밀번호 (6자 이상)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">새 비밀번호 확인</label>
                      <input
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                        className="w-full px-3 py-3 md:px-4 md:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none text-base"
                        placeholder="새 비밀번호를 다시 입력하세요"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 계정 정보 */}
              <div>
                <h2 className="text-base md:text-lg font-semibold text-white mb-3">계정 정보</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">가입일</label>
                    <div className="py-2">
                      <p className="text-white text-sm">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ko-KR') : '-'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">최종 로그인</label>
                    <div className="py-2">
                      <p className="text-white text-xs md:text-sm">
                        {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString('ko-KR') : '-'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm text-gray-400 mb-1.5">로그인 횟수</label>
                    <div className="py-2">
                      <p className="text-white text-sm">{profile?.login_count || 0}회</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 버튼 영역 - 모바일 최적화 */}
              {editMode && (
                <div className="flex flex-col md:flex-row justify-end gap-3 md:gap-4 pt-6 border-t border-gray-700">
                  <NeoButton
                    variant="secondary"
                    onClick={() => {
                      setEditMode(false);
                      setError(null);
                      setSuccess(null);
                      // 폼 데이터 리셋
                      setFormData({
                        name: profile?.full_name || '',
                        phone: profile?.phone || '',
                        department: profile?.department || '',
                        current_password: '',
                        new_password: '',
                        confirm_password: ''
                      });
                    }}
                    disabled={saving}
                    className="w-full md:w-auto"
                  >
                    취소
                  </NeoButton>
                  <NeoButton
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full md:w-auto"
                  >
                    {saving ? '저장 중...' : '저장'}
                  </NeoButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}