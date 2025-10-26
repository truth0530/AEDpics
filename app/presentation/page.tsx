'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();
  const totalSlides = 17;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
        setCurrentSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      } else if (e.key === 'Escape') {
        router.push('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, router]);

  const slides = [
    // Slide 1: Title
    {
      id: 1,
      content: (
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-6xl font-bold text-white mb-8">AED 스마트 점검 시스템</h1>
          <p className="text-3xl text-gray-300 mb-12">2025년 자동심장충격기 현지점검 시스템 구축 계획</p>
          <div className="text-xl text-gray-400">
            <p>중앙응급의료센터 대세인</p>
            <p className="mt-2">2025년 9월 18일 </p>
          </div>
        </div>
      )
    },
    // Slide 2: 현황 및 문제점
    {
      id: 2,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">현황 및 문제점</h2>
          <div className="flex items-center justify-center flex-1">
            <div className="grid grid-cols-2 gap-12 w-full max-w-5xl">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-6 text-green-400">현재 상황</h3>
                <ul className="space-y-4 text-xl text-gray-300">
                  <li>• 전국 81,331대 AED</li>
                  <li>• 260여개 보건소 개별 관리</li>
                  <li>• 매년 현지 점검 전수 조사</li>
                </ul>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white mb-6 text-yellow-400">주요 문제점</h3>
                <ul className="space-y-4 text-xl text-gray-300">
                  <li>• 점검 누락 및 지연</li>
                  <li>• 데이터 불일치 및 오류</li>
                  <li>• 실시간 현황 파악 불가</li>
                  <li>• 비효율적 인력 운용</li>
                  <li>• 점검 대상 관리, 점검 결과 등록, 통계 시스템 부재</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 3: 점검자 고충 시각화 (새로 추가)
    {
      id: 3,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-red-500 pb-4">점검자가 직면한 현실적 문제</h2>
          <div className="grid grid-cols-2 gap-6 flex-1 overflow-y-auto">
            
            {/* 1. 어디서부터 시작할지 난감 */}
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-orange-500">
              <div className="flex items-start gap-4">
                <svg className="w-16 h-16 text-orange-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-400 mb-2">시작점 선택의 어려움</h3>
                  <p className="text-gray-300 text-sm mb-2">수백 대의 AED 중 어느 것부터 점검해야 할지 우선순위 판단 불가</p>
                  <div className="bg-gray-900 rounded p-2 text-xs text-gray-400">
                    &quot;긴급한 것? 가까운 것? 오래된 것?&quot; - 가까운 곳 부터
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 비효율적 동선 */}
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
              <div className="flex items-start gap-4">
                <svg className="w-16 h-16 text-red-400 flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                  <circle cx="8" cy="10" r="2" fill="currentColor" opacity="0.5"/>
                  <circle cx="16" cy="14" r="2" fill="currentColor" opacity="0.5"/>
                  <path d="M8 10L16 14" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" opacity="0.5"/>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-400 mb-2">이동 경로의 비효율</h3>
                  <p className="text-gray-300 text-sm mb-2">우선순위와 실제 이동 동선이 맞지 않아 시간과 비용 낭비</p>
                  <div className="bg-gray-900 rounded p-2 text-xs text-gray-400">
                    이동가능한 동선 위주로 계획 
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 사전정보 부재 */}
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500">
              <div className="flex items-start gap-4">
                <svg className="w-16 h-16 text-yellow-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
                  <text x="12" y="11" textAnchor="middle" fontSize="10" fill="white">?</text>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">현장 도착 후 문제 파악</h3>
                  <p className="text-gray-300 text-sm mb-2">사전 정보 없이 현장에서 처음으로 장비 상태 확인</p>
                  <div className="bg-gray-900 rounded p-2 text-xs text-gray-400">
                    도착전, 점검후 부가 업무 증가
                  </div>
                </div>
              </div>
            </div>

            {/* 4. 이중 행정 부담 */}
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
              <div className="flex items-start gap-4">
                <svg className="w-16 h-16 text-purple-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                  <path d="M14 2l6 6h-6z" fill="white" opacity="0.3"/>
                  <path d="M8 14h8v2H8zm0-3h8v2H8zm0 6h5v2H8z" fill="white" opacity="0.5"/>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-400 mb-2">현장 메모 → 사무실 정리</h3>
                  <p className="text-gray-300 text-sm mb-2">현장 점검 내용을 사무실에서 다시 정리하고 보고서 작성</p>
                  <div className="bg-gray-900 rounded p-2 text-xs text-gray-400">
                    점검 1건당 행정 처리 시간: 평균 25분 추가 소요
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 데이터 동기화 문제 */}
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="flex items-start gap-4">
                <svg className="w-16 h-16 text-blue-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  <path d="M17 8l-7 7-3.59-3.59L5 12.83l5 5 9-9z" stroke="red" strokeWidth="2" fill="none"/>
                  <line x1="5" y1="5" x2="19" y2="19" stroke="red" strokeWidth="2"/>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">점검 결과 ≠ 실제 정보 수정</h3>
                  <p className="text-gray-300 text-sm mb-2">점검 완료 후에도 실제 데이터베이스는 업데이트되지 않음</p>
                  <div className="bg-gray-900 rounded p-2 text-xs text-gray-400">
                    점검 데이터와 e-gen 시스템 불일치율 방치
                  </div>
                </div>
              </div>
            </div>

            {/* 6. 다중 시스템 관리 */}
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
              <div className="flex items-start gap-4">
                <svg className="w-16 h-16 text-green-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <g>
                    <rect x="4" y="4" width="6" height="6" rx="1"/>
                    <rect x="14" y="4" width="6" height="6" rx="1"/>
                    <rect x="4" y="14" width="6" height="6" rx="1"/>
                    <rect x="14" y="14" width="6" height="6" rx="1"/>
                    <path d="M10 7h4M7 10v4M17 10v4M10 17h4" stroke="red" strokeWidth="1" strokeDasharray="1,1"/>
                  </g>
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">시스템별 개별 수정 필요</h3>
                  <p className="text-gray-300 text-sm mb-2">관리책임자 변경, 새올행정시스템 등 각각 별도 수정 필요</p>
                  <div className="bg-gray-900 rounded p-2 text-xs text-gray-400">
                    결국 다른 정보로 방치되는 현실 
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 하단 요약 */}
          <div className="mt-4 bg-red-900/20 border border-red-600/30 rounded-lg p-3">
            <p className="text-center text-red-300 text-sm font-medium">
              💡 결과: 점검자 1인당 방문 수 제한 <span className="text-red-400 font-bold"></span>의 비생산적 업무 + 
              <span className="text-red-400 font-bold"> 35%</span>의 재작업 발생
            </p>
          </div>
        </div>
      )
    },
    // Slide 4: 시스템 목표 (기존 3번에서 4번으로 변경)
    {
      id: 4,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">시스템 구축 목표</h2>
          <div className="grid grid-cols-3 gap-6 flex-1">
            <div className="bg-gray-800 rounded-lg p-6 flex flex-col">
              <div className="text-green-400 text-3xl mb-4">01</div>
              <h3 className="text-2xl font-semibold text-white mb-3">효율성 극대화</h3>
              <ul className="space-y-2 text-gray-300 text-base">
                <li>• 점검 시간 단축</li>
                <li>• 최적 경로 자동 계산</li>
                <li>• 실시간 데이터 동기화</li>
                <li>• 스마트한 일정 관리와 협업체계 구축</li>                
              </ul>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 flex flex-col">
              <div className="text-green-400 text-3xl mb-4">02</div>
              <h3 className="text-2xl font-semibold text-white mb-3">정확성 향상</h3>
              <ul className="space-y-2 text-gray-300 text-base">
                <li>• 디지털 점검 체크리스트</li>
                <li>• 사진 기반 증빙 관리</li>
                <li>• GPS 위치 자동 확인</li>
                <li>• 오류 자동 검증 시스템</li>
              </ul>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 flex flex-col">
              <div className="text-green-400 text-3xl mb-4">03</div>
              <h3 className="text-2xl font-semibold text-white mb-3">통합 관리 체계</h3>
              <ul className="space-y-2 text-gray-300 text-base">
                <li>• 중앙 집중식 모니터링</li>
                <li>• 실시간 현황 대시보드</li>
                <li>• 자동 보고서 생성</li>
                <li>• 예측 기반 유지보수</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    // Slide 4: 주요 기능 (수정됨)
    {
      id: 4,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">주요 기능</h2>
          <div className="grid grid-cols-2 gap-6 flex-1">
            <div className="space-y-3">
              <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
                <h3 className="text-xl font-semibold text-white mb-2">모바일 점검 앱</h3>
                <p className="text-gray-300 text-base">오프라인 지원, GPS 기반 점검, 사진 촬영, 음성 입력</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
                <h3 className="text-xl font-semibold text-white mb-2">실시간 대시보드</h3>
                <p className="text-gray-300 text-base">점검 현황, 긴급 알림, 통계 분석, 승인 대기 알림</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
                <h3 className="text-xl font-semibold text-white mb-2">우선순위 관리 시스템</h3>
                <p className="text-gray-300 text-base">유효기간별/점검순서별 분류, 날짜별 자동 배치, 회피날짜 설정</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500">
                <h3 className="text-xl font-semibold text-white mb-2">팀 협업 관리</h3>
                <p className="text-gray-300 text-base">인력 배치 최적화, 1인당 할당량 자동 계산, 효율성 분석</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
                <h3 className="text-xl font-semibold text-white mb-2">통합 데이터 관리</h3>
                <p className="text-gray-300 text-base">e-gen 연동, 실시간 동기화, 이력 관리, 백업 체계</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 400 400" className="w-full h-full max-w-md">
                  <circle cx="200" cy="200" r="150" fill="none" stroke="#10b981" strokeWidth="2"/>
                  <circle cx="200" cy="100" r="40" fill="#10b981" opacity="0.2"/>
                  <circle cx="200" cy="100" r="30" fill="#10b981"/>
                  <text x="200" y="105" textAnchor="middle" fill="white" fontSize="12">모바일</text>
                  
                  <circle cx="300" cy="200" r="40" fill="#3b82f6" opacity="0.2"/>
                  <circle cx="300" cy="200" r="30" fill="#3b82f6"/>
                  <text x="300" y="205" textAnchor="middle" fill="white" fontSize="12">대시보드</text>
                  
                  <circle cx="200" cy="300" r="40" fill="#a855f7" opacity="0.2"/>
                  <circle cx="200" cy="300" r="30" fill="#a855f7"/>
                  <text x="200" y="305" textAnchor="middle" fill="white" fontSize="12">우선순위</text>
                  
                  <circle cx="100" cy="200" r="40" fill="#eab308" opacity="0.2"/>
                  <circle cx="100" cy="200" r="30" fill="#eab308"/>
                  <text x="100" y="205" textAnchor="middle" fill="white" fontSize="12">팀협업</text>
                  
                  <line x1="170" y1="130" x2="130" y2="170" stroke="#666" strokeWidth="1"/>
                  <line x1="230" y1="130" x2="270" y2="170" stroke="#666" strokeWidth="1"/>
                  <line x1="270" y1="230" x2="230" y2="270" stroke="#666" strokeWidth="1"/>
                  <line x1="130" y1="230" x2="170" y2="270" stroke="#666" strokeWidth="1"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 5: 시스템 아키텍처 (수정됨 - 실제 기술 스택)
    {
      id: 5,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">시스템 아키텍처</h2>
          <div className="flex-1 flex items-center">
            <div className="w-full">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="bg-green-600 rounded-lg p-4 mb-2">
                    <p className="text-white font-semibold">Frontend</p>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Next.js 15</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">React 18</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">TypeScript</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Tailwind CSS</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="bg-blue-600 rounded-lg p-4 mb-2">
                    <p className="text-white font-semibold">Backend</p>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Supabase</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Edge Functions</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">REST API</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Realtime</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="bg-purple-600 rounded-lg p-4 mb-2">
                    <p className="text-white font-semibold">Database</p>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">PostgreSQL</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Vector DB</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Storage</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">RLS 보안</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="bg-yellow-600 rounded-lg p-4 mb-2">
                    <p className="text-white font-semibold">Services</p>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Vercel</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Resend</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">Kakao Map</div>
                    <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">PWA</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 bg-gray-800 rounded-lg p-4">
                <p className="text-center text-gray-300">서버리스 아키텍처 | Row Level Security | 실시간 동기화 | 자동 스케일링</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 6: 모바일 앱 화면 (구체화)
    {
      id: 6,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">모바일 앱 주요 화면</h2>
          <div className="flex-1 grid grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="bg-gray-900 rounded-lg h-40 mb-3 flex flex-col items-center justify-center p-3">
                <svg className="w-12 h-12 text-green-400 mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <div className="text-xs text-gray-500 text-center">
                  • 운영상태 버튼식 선택<br/>
                  • 요일별 운영시간<br/>
                  • 사진 필수/선택 구분
                </div>
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">점검 입력</h3>
              <p className="text-gray-400 text-xs">상세 체크리스트 및 증빙</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="bg-gray-900 rounded-lg h-40 mb-3 flex flex-col items-center justify-center p-3">
                <svg className="w-12 h-12 text-blue-400 mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <div className="text-xs text-gray-500 text-center">
                  • 우선순위 기반 정렬<br/>
                  • 최적 경로 안내<br/>
                  • 오프라인 지원
                </div>
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">지도 보기</h3>
              <p className="text-gray-400 text-xs">GPS 기반 네비게이션</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="bg-gray-900 rounded-lg h-40 mb-3 flex flex-col items-center justify-center p-3">
                <svg className="w-12 h-12 text-purple-400 mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                </svg>
                <div className="text-xs text-gray-500 text-center">
                  • 캘린더 뷰<br/>
                  • 점검 회피날짜<br/>
                  • 일일 할당량 표시
                </div>
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">스케줄 관리</h3>
              <p className="text-gray-400 text-xs">자동 배치된 일정</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="bg-gray-900 rounded-lg h-40 mb-3 flex flex-col items-center justify-center p-3">
                <svg className="w-12 h-12 text-yellow-400 mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
                <div className="text-xs text-gray-500 text-center">
                  • 개인 실적<br/>
                  • 팀 현황<br/>
                  • 효율성 지표
                </div>
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">통계 현황</h3>
              <p className="text-gray-400 text-xs">실시간 대시보드</p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 7: 점검 프로세스 (상세화)
    {
      id: 7,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">점검 프로세스</h2>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-start mb-8">
              <div className="text-center flex-1">
                <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-2xl font-bold">1</span>
                </div>
                <h3 className="text-white font-semibold text-lg">일정 확인</h3>
                <p className="text-gray-400 text-sm mt-1">우선순위 기반<br/>자동 배정</p>
              </div>
              
              <div className="text-gray-500 text-2xl pt-10">→</div>
              
              <div className="text-center flex-1">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-2xl font-bold">2</span>
                </div>
                <h3 className="text-white font-semibold text-lg">현장 방문</h3>
                <p className="text-gray-400 text-sm mt-1">GPS 경로 안내<br/>오프라인 모드</p>
              </div>
              
              <div className="text-gray-500 text-2xl pt-10">→</div>
              
              <div className="text-center flex-1">
                <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-2xl font-bold">3</span>
                </div>
                <h3 className="text-white font-semibold text-lg">점검 수행</h3>
                <p className="text-gray-400 text-sm mt-1">체크리스트<br/>사진/음성 입력</p>
              </div>
              
              <div className="text-gray-500 text-2xl pt-10">→</div>
              
              <div className="text-center flex-1">
                <div className="w-20 h-20 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-2xl font-bold">4</span>
                </div>
                <h3 className="text-white font-semibold text-lg">데이터 동기화</h3>
                <p className="text-gray-400 text-sm mt-1">실시간 전송<br/>오프라인 큐</p>
              </div>
              
              <div className="text-gray-500 text-2xl pt-10">→</div>
              
              <div className="text-center flex-1">
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-2xl font-bold">5</span>
                </div>
                <h3 className="text-white font-semibold text-lg">보고서 생성</h3>
                <p className="text-gray-400 text-sm mt-1">자동 생성<br/>이메일 전송</p>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 mt-4">
              <h4 className="text-white font-semibold mb-3">점검 항목 상세</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-green-400 font-semibold mb-2">필수 확인</p>
                  <ul className="text-gray-300 space-y-1 text-xs">
                    <li>• 배터리/패드 유효기간</li>
                    <li>• 운영상태 (정상/고장/분실)</li>
                    <li>• 작동 테스트</li>
                  </ul>
                </div>
                <div>
                  <p className="text-blue-400 font-semibold mb-2">위치/접근성</p>
                  <ul className="text-gray-300 space-y-1 text-xs">
                    <li>• GPS 좌표 확인</li>
                    <li>• 요일별 운영시간</li>
                    <li>• 안내표지 다중선택</li>
                  </ul>
                </div>
                <div>
                  <p className="text-purple-400 font-semibold mb-2">증빙 자료</p>
                  <ul className="text-gray-300 space-y-1 text-xs">
                    <li>• 기기 전면 사진 (필수)</li>
                    <li>• 문제 부위 사진 (조건부)</li>
                    <li>• 음성 메모 (선택)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 8: 우선순위 관리 시스템 (새로 추가)
    {
      id: 8,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">스마트 우선순위 관리</h2>
          <div className="flex-1 grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">자동 우선순위 계산</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-red-900/30 rounded p-2">
                    <span className="text-red-400 text-sm">긴급 (30일 이내)</span>
                    <span className="text-white font-bold">156대</span>
                  </div>
                  <div className="flex items-center justify-between bg-yellow-900/30 rounded p-2">
                    <span className="text-yellow-400 text-sm">경고 (31-60일)</span>
                    <span className="text-white font-bold">342대</span>
                  </div>
                  <div className="flex items-center justify-between bg-green-900/30 rounded p-2">
                    <span className="text-green-400 text-sm">정상 (61일 이상)</span>
                    <span className="text-white font-bold">1,847대</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">분류 기준</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    유효기간별 (배터리/패드)
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    최근 점검일 경과 기간
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    구비의무기관 우선 배정
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    지역별 균등 분배
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">스케줄 자동 배치</h3>
              <div className="bg-gray-900 rounded p-3 mb-3">
                <div className="grid grid-cols-7 gap-1 text-xs text-center mb-2">
                  {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                    <div key={day} className="text-gray-400">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({length: 28}, (_, i) => {
                    const date = i + 1;
                    const isWeekend = i % 7 === 0 || i % 7 === 6;
                    const isHoliday = date === 15 || date === 25;
                    const count = isHoliday ? 0 : isWeekend ? 8 : 15;
                    
                    return (
                      <div key={i} className={`p-2 rounded text-center ${
                        isHoliday ? 'bg-red-900/50' :
                        isWeekend ? 'bg-gray-700' :
                        'bg-gray-600'
                      }`}>
                        <div className="text-white text-xs">{date}</div>
                        {!isHoliday && (
                          <div className="text-xs mt-1 text-gray-400">{count}대</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <div className="flex gap-3">
                  <span className="flex items-center">
                    <div className="w-3 h-3 bg-gray-600 rounded mr-1"></div>
                    <span className="text-gray-400">평일</span>
                  </span>
                  <span className="flex items-center">
                    <div className="w-3 h-3 bg-gray-700 rounded mr-1"></div>
                    <span className="text-gray-400">주말</span>
                  </span>
                  <span className="flex items-center">
                    <div className="w-3 h-3 bg-red-900/50 rounded mr-1"></div>
                    <span className="text-gray-400">회피</span>
                  </span>
                </div>
                <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                  스케줄 확정
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 10: 팀 협업 관리 (기존 9번에서 10번으로 변경)
    {
      id: 10,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">효율적인 팀 협업 관리</h2>
          <div className="flex-1 grid grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-white mb-4">일일 인력 배치</h3>
              <div className="bg-gray-900 rounded p-3 mb-3">
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-gray-400 text-xs">날짜</p>
                    <p className="text-white font-semibold">2025.01.15</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">할당 AED</p>
                    <p className="text-white font-semibold">20대</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">가용 인력</p>
                    <p className="text-white font-semibold">5명</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-white font-semibold text-sm mb-2">자동 배치 결과</h4>
                {[
                  { name: '김정호', type: '정규', count: 4, route: '강남구' },
                  { name: '이민수', type: '정규', count: 4, route: '서초구' },
                  { name: '박영희', type: '정규', count: 4, route: '송파구' },
                  { name: '최지훈', type: '임시', count: 4, route: '강동구' },
                  { name: '정수진', type: '임시', count: 4, route: '광진구' }
                ].map((staff, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-700 rounded p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm">{staff.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        staff.type === '정규' ? 'bg-green-600' : 'bg-yellow-600'
                      }`}>
                        {staff.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">{staff.route}</span>
                      <span className="text-white bg-blue-600 px-2 py-1 rounded text-xs">
                        {staff.count}대
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-white mb-3">효율성 분석</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1">총 이동거리</p>
                    <p className="text-2xl font-bold text-white">125.4km</p>
                    <p className="text-green-400 text-xs mt-1">▼ 15% 최적화</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1">예상 완료</p>
                    <p className="text-2xl font-bold text-white">16:30</p>
                    <p className="text-gray-400 text-xs mt-1">평균 20분/대</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1">효율성</p>
                    <p className="text-2xl font-bold text-green-400">92%</p>
                    <p className="text-gray-400 text-xs mt-1">목표 대비 +12%</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1">비용 절감</p>
                    <p className="text-2xl font-bold text-blue-400">32%</p>
                    <p className="text-gray-400 text-xs mt-1">전월 대비</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-white mb-3">최적화 제안</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">•</span>
                    김정호, 이민수 경로 교환 시 15km 단축
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">•</span>
                    오전 시간대 병원 위주 배치 권장
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-400 mr-2">•</span>
                    임시직원 2명 팀 구성으로 효율 20% 증가
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 11: 웹 관리자 대시보드 (기존 10번에서 11번으로 변경)
    {
      id: 11,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">웹 관리자 대시보드</h2>
          <div className="flex-1 grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
                <h3 className="text-lg font-semibold text-white mb-2">실시간 모니터링</h3>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-gray-900 rounded p-2 text-center">
                    <p className="text-2xl font-bold text-green-400">87%</p>
                    <p className="text-xs text-gray-400">점검 완료율</p>
                  </div>
                  <div className="bg-gray-900 rounded p-2 text-center">
                    <p className="text-2xl font-bold text-yellow-400">23</p>
                    <p className="text-xs text-gray-400">진행중</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-yellow-400">승인 대기 알림</h3>
                  <span className="bg-yellow-600 text-white px-2 py-1 rounded-full text-xs">3명</span>
                </div>
                <p className="text-sm text-gray-300 mb-2">임시 점검원 승인 대기 중</p>
                <button className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm">
                  승인 관리
                </button>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
                <h3 className="text-lg font-semibold text-white mb-2">긴급 알림</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center text-red-400">
                    <span className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                    배터리 교체 필요 (서울시청)
                  </li>
                  <li className="flex items-center text-yellow-400">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                    패드 유효기간 임박 (강남구청)
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">지역별 점검 현황</h3>
              <div className="space-y-3">
                {[
                  { region: '서울특별시', percent: 92, color: 'green' },
                  { region: '경기도', percent: 85, color: 'green' },
                  { region: '인천광역시', percent: 78, color: 'yellow' },
                  { region: '강원도', percent: 71, color: 'yellow' },
                  { region: '충청남도', percent: 65, color: 'red' }
                ].map((item) => (
                  <div key={item.region}>
                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                      <span>{item.region}</span>
                      <span>{item.percent}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className={`bg-${item.color}-500 h-2 rounded-full`} 
                        style={{width: `${item.percent}%`}}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">전국 평균</span>
                  <span className="text-white font-bold">78.2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 12: 통계 및 분석 (기존 11번에서 12번으로 변경)
    {
      id: 12,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">통계 및 분석</h2>
          <div className="flex-1 grid grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">월별 점검 추이</h3>
              <div className="space-y-2">
                {['10월', '11월', '12월', '1월'].map((month, i) => (
                  <div key={month}>
                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                      <span>{month}</span>
                      <span>{[20333, 20333, 20333, 5089][i].toLocaleString()}건</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: `${[100, 100, 100, 25][i]}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-400">연간 목표: 81,331대 × 4회</p>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">문제 유형 분석</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">배터리 불량</span>
                  <span className="text-red-400 font-semibold">32%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">패드 만료</span>
                  <span className="text-yellow-400 font-semibold">28%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">위치 부적절</span>
                  <span className="text-blue-400 font-semibold">18%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">기기 고장</span>
                  <span className="text-purple-400 font-semibold">12%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">기타</span>
                  <span className="text-gray-400 font-semibold">10%</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">예측 분석</h3>
              <div className="space-y-3">
                <div className="bg-gray-900 rounded p-3">
                  <p className="text-yellow-400 text-sm font-semibold mb-1">다음 달 예상</p>
                  <p className="text-2xl font-bold text-white">423대</p>
                  <p className="text-xs text-gray-400">배터리 교체 필요</p>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <p className="text-blue-400 text-sm font-semibold mb-1">3개월 내</p>
                  <p className="text-2xl font-bold text-white">1,287대</p>
                  <p className="text-xs text-gray-400">패드 교체 예정</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 13: 보고서 자동 생성 (기존 12번에서 13번으로 변경)
    {
      id: 13,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">보고서 자동 생성</h2>
          <div className="flex-1 grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-white mb-3">보고서 유형</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-gray-900 rounded p-3">
                    <span className="text-gray-300">일일 점검 보고서</span>
                    <span className="text-green-400 text-sm">매일 18:00</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-900 rounded p-3">
                    <span className="text-gray-300">주간 종합 보고서</span>
                    <span className="text-blue-400 text-sm">매주 월요일</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-900 rounded p-3">
                    <span className="text-gray-300">월간 통계 보고서</span>
                    <span className="text-purple-400 text-sm">매월 1일</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-900 rounded p-3">
                    <span className="text-gray-300">분기 분석 보고서</span>
                    <span className="text-yellow-400 text-sm">분기별</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-white mb-3">포함 내용</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    점검 완료 현황 및 통계
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    문제 발견 및 조치 사항
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    지역별/기관별 상세 분석
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    향후 예측 및 권장사항
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-white mb-4">자동 배포 설정</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4">
                  <p className="text-white font-semibold mb-1">보건복지부</p>
                  <p className="text-gray-400 text-sm">월간 종합 보고서</p>
                  <p className="text-gray-500 text-xs mt-1">ministry@mohw.go.kr</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="text-white font-semibold mb-1">시·도 보건과</p>
                  <p className="text-gray-400 text-sm">주간 지역별 보고서</p>
                  <p className="text-gray-500 text-xs mt-1">17개 시·도 담당자</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <p className="text-white font-semibold mb-1">보건소장</p>
                  <p className="text-gray-400 text-sm">일일 점검 보고서</p>
                  <p className="text-gray-500 text-xs mt-1">261개 보건소</p>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4">
                  <p className="text-white font-semibold mb-1">중앙응급의료센터(닥터헬기팀, 응급의료지원센터)</p>
                  <p className="text-gray-400 text-sm">긴급 상황 즉시 알림</p>
                  <p className="text-gray-500 text-xs mt-1">실시간 전송</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 14: 보안 및 권한 관리 (기존 13번에서 14번으로 변경)
    {
      id: 14,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-green-500 pb-4">보안 및 권한 관리</h2>
          <div className="flex-1 grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">3단계 가입 프로세스</h3>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded-lg p-4 flex items-center">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold">이메일 도메인 검증</p>
                    <p className="text-gray-400 text-sm">@korea.kr 도메인 자동 인증</p>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4 flex items-center">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold">OTP 이메일 인증</p>
                    <p className="text-gray-400 text-sm">6자리 코드 발송 및 확인</p>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4 flex items-center">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-bold">3</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold">관리자 승인</p>
                    <p className="text-gray-400 text-sm">임시 점검원은 보건소 승인 필요</p>
                  </div>
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-white mt-6 mb-3">보안 체계</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  SSL/TLS 전구간 암호화
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Row Level Security (RLS)
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  모든 활동 로그 기록
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">권한 체계</h3>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-400 font-semibold">정규 직원</span>
                    <span className="text-xs bg-green-600 px-2 py-1 rounded">자동 승인</span>
                  </div>
                  <p className="text-gray-400 text-sm">보건소 도메인 인증, 전체 기능 접근</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-yellow-400 font-semibold">임시 점검원</span>
                    <span className="text-xs bg-yellow-600 px-2 py-1 rounded">승인 필요</span>
                  </div>
                  <p className="text-gray-400 text-sm">보건소 사전 승인 후 권한 부여, 제한된 접근, 기간 한정</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-blue-400 font-semibold">시·도 관리자</span>
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded">Level 4</span>
                  </div>
                  <p className="text-gray-400 text-sm">지역별 통계, 보고서 관리</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-purple-400 font-semibold">중앙 관리자</span>
                    <span className="text-xs bg-purple-600 px-2 py-1 rounded">Master</span>
                  </div>
                  <p className="text-gray-400 text-sm">전체 시스템 관리, 사용자 승인 관리</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 15: 구축 일정 (기존 14번에서 15번으로 변경)
    {
      id: 15,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">구축 일정</h2>
          <div className="flex-1">
            <div className="space-y-4">
              <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6">
                <p className="text-blue-400 font-semibold mb-2">핵심 전략</p>
                <p className="text-white">점검 기능 구현 최우선 → 3개월 내 현장 배포 → 이후 편의기능 및 고도화</p>
              </div>
              
              <div className="flex items-center">
                <div className="w-32 text-green-400 font-semibold">1-2주차</div>
                <div className="flex-1 bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">기본 점검 기능 구현</p>
                      <p className="text-gray-400 text-sm mt-1">모바일 점검 앱, 체크리스트, 사진 촬영, 데이터 동기화</p>
                    </div>
                    <span className="text-green-400 font-semibold">최우선</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="w-32 text-blue-400 font-semibold">3-4주차</div>
                <div className="flex-1 bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">우선순위 및 스케줄링</p>
                      <p className="text-gray-400 text-sm mt-1">자동 우선순위 계산, 일정 배치, 경로 최적화</p>
                    </div>
                    <span className="text-gray-500">2025.1월</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="w-32 text-purple-400 font-semibold">5-8주차</div>
                <div className="flex-1 bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">관리 시스템 구축</p>
                      <p className="text-gray-400 text-sm mt-1">대시보드, 팀 관리, 보고서 생성, 권한 관리</p>
                    </div>
                    <span className="text-gray-500">2025.2월</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="w-32 text-yellow-400 font-semibold">9-12주차</div>
                <div className="flex-1 bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">시범 운영 및 안정화</p>
                      <p className="text-gray-400 text-sm mt-1">3개 보건소 시범 운영, 피드백 반영, 버그 수정</p>
                    </div>
                    <span className="text-gray-500">2025.3월</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="w-32 text-red-400 font-semibold">13-24주차</div>
                <div className="flex-1 bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">편의기능 및 고도화</p>
                      <p className="text-gray-400 text-sm mt-1">AI 예측, 음성 입력, 오프라인 모드, 실시간 알림, 빅데이터 분석</p>
                    </div>
                    <span className="text-gray-500">2025.4-6월</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 16: 권한 관리 체계 (기존 15번에서 16번으로 변경)
    {
      id: 16,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">권한 관리 체계</h2>
          <div className="flex-1">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white">정규 직원</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-green-400 font-semibold text-sm mb-1">보건소 도메인 인증</p>
                    <p className="text-gray-400 text-xs">@korea.kr 이메일 필수</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-blue-400 font-semibold text-sm mb-1">즉시 승인</p>
                    <p className="text-gray-400 text-xs">자동 권한 부여</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-purple-400 font-semibold text-sm mb-1">전체 기능 접근</p>
                    <p className="text-gray-400 text-xs">모든 시스템 기능 사용 가능</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="w-20 h-20 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white">임시 점검원</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-yellow-400 font-semibold text-sm mb-1">보건소 사전 승인</p>
                    <p className="text-gray-400 text-xs">담당자 확인 후 권한 부여</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-orange-400 font-semibold text-sm mb-1">제한된 접근</p>
                    <p className="text-gray-400 text-xs">점검 기능만 사용 가능</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-red-400 font-semibold text-sm mb-1">기간 한정</p>
                    <p className="text-gray-400 text-xs">설정 기간 후 자동 만료</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white">시스템 관리자</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-blue-400 font-semibold text-sm mb-1">Master 계정</p>
                    <p className="text-gray-400 text-xs">최고 권한 보유</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-indigo-400 font-semibold text-sm mb-1">사용자 승인 권한</p>
                    <p className="text-gray-400 text-xs">임시 점검원 승인/거부</p>
                  </div>
                  <div className="bg-gray-900 rounded p-3">
                    <p className="text-purple-400 font-semibold text-sm mb-1">시스템 설정 관리</p>
                    <p className="text-gray-400 text-xs">정책 및 권한 설정</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 bg-gray-800 rounded-lg p-4">
              <p className="text-center text-gray-300">
                <span className="text-green-400 font-semibold">보안 원칙:</span> 최소 권한 부여 | 역할 기반 접근 제어 | 활동 로그 기록 | 정기 권한 검토
              </p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 16: 핵심 성공 요인
    {
      id: 16,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">핵심 성공 요인</h2>
          <div className="flex-1 grid grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">현장 중심 설계</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• 점검원 실제 업무 패턴 반영</li>
                <li>• 모바일 우선 인터페이스</li>
                <li>• 오프라인 모드 지원</li>
                <li>• 직관적 UI/UX</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.13-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">자동화 극대화</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• 우선순위 자동 계산</li>
                <li>• 스케줄 자동 배치</li>
                <li>• 보고서 자동 생성</li>
                <li>• 경로 최적화</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">단계적 구현</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• 핵심 기능 우선 개발</li>
                <li>• 3개월 내 현장 배포</li>
                <li>• 지속적 피드백 반영</li>
                <li>• 점진적 기능 확장</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-lg p-4 border border-green-500/50">
            <p className="text-center text-white">
              <span className="font-semibold">성공의 핵심:</span> 사용자 중심 설계 + 자동화 기술 + 체계적 실행 = 현장 혁신
            </p>
          </div>
        </div>
      )
    },
    // Slide 17: 결론
    {
      id: 17,
      content: (
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-5xl font-bold text-white mb-8">AED 스마트 점검 시스템</h1>
          <p className="text-2xl text-gray-300 mb-12">스마트한 점검으로 업무 효율성 극대화</p>
          
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-400 mb-2">81,331대</p>
              <p className="text-gray-400">관리 대상 AED</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-400 mb-2">261개</p>
              <p className="text-gray-400">참여 보건소</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-purple-400 mb-2">17개</p>
              <p className="text-gray-400">응급의료지원센터 시스템지원</p>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl">
            <p className="text-center text-gray-300 leading-relaxed">
              AED 스마트 점검 시스템으로 점검의 효율성을 높이고 
              점검으로 끝나지 않고 문제점을 도출하고 제도 개선과 정책 방향에 객관적인 지표를 제시합니다. 
            </p>
          </div>
          
          <div className="mt-8 text-gray-500">
            <p>대구 인천 세종 응급의료지원센터</p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      {/* Slide Container - 16:9 ratio */}
      <div className="w-full max-w-[1600px] mx-auto px-8">
        <div className="relative" style={{ paddingBottom: '56.25%' }}> {/* 16:9 Aspect Ratio */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl p-12 overflow-hidden">
            {slides[currentSlide].content}
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-900/90 backdrop-blur px-6 py-3 rounded-full">
        <button
          onClick={() => currentSlide > 0 && setCurrentSlide(currentSlide - 1)}
          className="text-white hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentSlide === 0}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide ? 'bg-green-400 w-8' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        
        <span className="text-white mx-4">{currentSlide + 1} / {totalSlides}</span>
        
        <button
          onClick={() => currentSlide < totalSlides - 1 && setCurrentSlide(currentSlide + 1)}
          className="text-white hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentSlide === totalSlides - 1}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        <button
          onClick={() => router.push('/')}
          className="ml-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Keyboard hints */}
      <div className="fixed top-4 right-4 text-gray-500 text-sm">
        <p>← → 화살표키로 이동</p>
        <p>ESC 종료</p>
      </div>
    </div>
  );
}