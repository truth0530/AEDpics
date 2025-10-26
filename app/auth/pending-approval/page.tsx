'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';

// 지역별 응급의료지원센터 목록
const emergencyCenters = [
  { region: '서울', center: '서울 응급의료지원센터', phone: '02-2133-7542' },
  { region: '부산', center: '부산 응급의료지원센터', phone: '051-254-3114' },
  { region: '대구', center: '대구 응급의료지원센터', phone: '053-427-0530' },
  { region: '인천', center: '인천 응급의료지원센터', phone: '032-440-3254' },
  { region: '광주', center: '광주 응급의료지원센터', phone: '062-233-1339' },
  { region: '대전', center: '대전 응급의료지원센터', phone: '042-223-5101' },
  { region: '울산', center: '울산 응급의료지원센터', phone: '052-229-3666' },
  { region: '세종', center: '세종 응급의료지원센터', phone: '044-300-5725' },
  { region: '경기', center: '경기 응급의료지원센터', phone: '031-8008-5641' },
  { region: '강원', center: '강원 응급의료지원센터', phone: '033-748-4911' },
  { region: '충북', center: '충북 응급의료지원센터', phone: '043-266-6124' },
  { region: '충남', center: '충남 응급의료지원센터', phone: '041-634-9351' },
  { region: '전북', center: '전북 응급의료지원센터', phone: '063-276-9573' },
  { region: '전남', center: '전남 응급의료지원센터', phone: '061-274-1339' },
  { region: '경북', center: '경북 응급의료지원센터', phone: '054-441-1339' },
  { region: '경남', center: '경남 응급의료지원센터', phone: '055-286-9548' },
  { region: '제주', center: '제주 응급의료지원센터', phone: '064-710-2337' }
];

export default function PendingApprovalPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [userInfo, setUserInfo] = useState<{
    email: string;
    fullName: string;
    accountType?: string;
    organizationName?: string;
  } | null>(null);
  const [showEmergencyCenters, setShowEmergencyCenters] = useState(false);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (status === 'loading') return;

      if (!session?.user) {
        router.push('/auth/signin');
        return;
      }

      // 프로필 정보 API에서 가져오기
      const response = await fetch(`/api/user/profile/${session.user.id}`);

      if (!response.ok) {
        router.push('/auth/complete-profile');
        return;
      }

      const profile = await response.json();

      // 승인되었으면 대시보드로 이동
      if (profile.role !== 'pending_approval') {
        router.push('/dashboard');
        return;
      }

      setUserInfo({
        email: profile.email,
        fullName: profile.fullName,
        accountType: 'public',
        organizationName: profile.organizationName
      });
    };

    checkUserStatus();

    // 30초마다 상태 체크
    const interval = setInterval(checkUserStatus, 30000);
    return () => clearInterval(interval);
  }, [session, status, router]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/signin');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md mx-auto pt-8">
        <GlassCard glow>
          <div className="text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-yellow-500/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              <h1 className="text-2xl font-bold text-white mb-2">
                승인 대기 중
              </h1>
              
              {userInfo && (
                <div className="text-gray-400 mb-4">
                  <p className="text-sm">{userInfo.fullName}님</p>
                  <p className="text-xs text-gray-500">{userInfo.email}</p>
                </div>
              )}
              
              <p className="text-gray-300 text-sm">
                회원가입이 완료되었습니다.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-xl rounded-xl p-5 mb-6 border border-gray-700/50">
              <h2 className="text-base font-semibold text-white mb-3">
                승인 진행 상태
              </h2>
              <ul className="text-left text-sm space-y-3">
                <li className="flex items-start">
                  <span className="text-green-400 mr-3 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </span>
                  <div>
                    <span className="text-gray-300 font-medium">이메일 인증 완료</span>
                    <p className="text-xs text-gray-500 mt-1">완료됨</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-3 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </span>
                  <div>
                    <span className="text-gray-300 font-medium">프로필 정보 입력 완료</span>
                    <p className="text-xs text-gray-500 mt-1">완료됨</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-3 mt-0.5 animate-pulse">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                  </span>
                  <div>
                    <span className="text-yellow-400 font-medium">관리자 승인 검토 중</span>
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-gray-400">신청서 검토 단계</p>
                      <p className="text-xs text-yellow-400">예상 완료: 1-2 업무일 이내</p>
                    </div>
                  </div>
                </li>
                <li className="flex items-start opacity-50">
                  <span className="text-gray-500 mr-3 mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                  </span>
                  <div>
                    <span className="text-gray-500 font-medium">승인 완료 및 시스템 활성화</span>
                    <p className="text-xs text-gray-600 mt-1">다음 단계</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* 정보 수정 버튼 추가 */}
            <div className="mb-6">
              <button
                onClick={() => router.push('/profile?from=pending')}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
              >
                입력한 정보 수정하기
              </button>
            </div>

            {/* 계정 타입에 따른 다른 메시지 표시 */}
            {userInfo?.accountType === 'public' ? (
              <>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <p className="text-green-400 text-sm font-semibold">공공기관 계정 승인 처리</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-gray-300 text-sm">
                      신청이 정상적으로 접수되었습니다
                    </p>
                    <div className="bg-gray-800/40 p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">처리 현황</p>
                      <p className="text-sm text-white">관리자 검토 중</p>
                      <p className="text-xs text-green-400 mt-1">
                        예상 완료: 1-2 업무일 이내
                      </p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                      <p className="text-xs text-blue-400 mb-1">결과 안내</p>
                      <p className="text-xs text-gray-300">
                        승인/거부 결과를 이메일로 안내드립니다
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-blue-400 font-semibold mb-3">
                    📞 관할 응급의료지원센터 연락처
                  </p>
                  <button
                    onClick={() => setShowEmergencyCenters(!showEmergencyCenters)}
                    className="text-green-400 hover:text-green-300 transition-colors underline text-sm"
                  >
                    {showEmergencyCenters ? '연락처 숨기기' : '지역별 연락처 보기'}
                  </button>
                  
                  {showEmergencyCenters && (
                    <div className="mt-4 max-h-60 overflow-y-auto border border-gray-700 rounded-lg">
                      <div className="grid gap-1">
                        {emergencyCenters.map((center, index) => (
                          <div key={index} className="flex justify-between text-xs p-2 bg-gray-800/40 hover:bg-gray-800/60 transition-colors">
                            <span className="text-gray-300">{center.center}</span>
                            <a href={`tel:${center.phone}`} className="text-green-400 font-mono hover:text-green-300">
                              {center.phone}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                    <div className="text-left">
                      <p className="text-sm text-yellow-400 font-semibold mb-2">
                        임시 점검원 승인 대기 중
                      </p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        관리자 승인 후 시스템 이용이 가능합니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <div className="text-left">
                      <p className="text-sm text-red-400 font-semibold mb-2">
                        ⚠️ 중요 안내
                      </p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        승인 요청은 반드시 보건소 응급의료담당자를 통해
                        <br />
                        응급의료지원센터로 유선연락이 되어야 합니다.
                      </p>
                      {userInfo?.organizationName && (
                        <p className="text-xs text-green-400 mt-3 p-2 bg-gray-800/40 rounded">
                          소속 보건소: <span className="font-semibold">{userInfo.organizationName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-gray-400 text-sm mb-6 p-4 bg-gray-800/20 rounded-xl">
                  <p className="mb-2 text-yellow-400">📋 임시 점검원 권한 안내</p>
                  <ul className="text-xs leading-relaxed space-y-1">
                    <li>• 보건소에서 할당한 AED 장비만 점검 가능</li>
                    <li>• 전체 데이터 열람 불가</li>
                    <li>• 보고서 생성 기능 제한</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">
                    정식 권한이 필요하신 경우 공공기관 이메일(@korea.kr, @nmc.or.kr)로 가입 후 관리자 승인을 받으세요.
                  </p>
                </div>
              </>
            )}

            <div className="text-gray-400 text-sm mb-6 p-4 bg-gray-800/20 rounded-xl">
              <p className="mb-1">기타 문의사항</p>
              <p className="text-green-400 font-medium">
                중앙응급의료센터: truth0530@nmc.or.kr
              </p>
              {userInfo?.email.endsWith('@nmc.or.kr') && (
                <p className="text-sm text-yellow-400 mt-2">
                  <span className="text-yellow-400">*</span> @nmc.or.kr 도메인 사용자도 기존 NMC 직원 또는 마스터 계정의 승인이 필요합니다.
                </p>
              )}
            </div>

            <NeoButton
              onClick={handleLogout}
              variant="secondary"
              fullWidth
              size="lg"
            >
              로그아웃
            </NeoButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}