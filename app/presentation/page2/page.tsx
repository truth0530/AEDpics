'use client';

import { useState, useEffect } from 'react';

export default function PresentationPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 8;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
        setCurrentSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const slides = [
    // Slide 1: Title
    {
      id: 1,
      content: (
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-5xl font-bold text-white mb-8 text-center leading-tight">복지부 AED 관리체계 연구용역</h1>
          <p className="text-3xl text-gray-300 mb-12">현장점검 현황 분석</p>
          <div className="text-xl text-gray-400">
            <p>중앙응급의료센터</p>
          </div>
        </div>
      )
    },
    // Slide 2: 개요
    {
      id: 2,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">개요</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-4xl">
              <svg viewBox="0 0 800 250" className="w-full mb-8">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                  </marker>
                </defs>
                
                {/* 타임라인 */}
                <line x1="100" y1="125" x2="700" y2="125" stroke="#374151" strokeWidth="3"/>
                
                {/* 2020-2023 */}
                <circle cx="250" cy="125" r="8" fill="#fbbf24"/>
                <rect x="150" y="50" width="200" height="60" rx="10" fill="#374151"/>
                <text x="250" y="80" textAnchor="middle" fill="#fbbf24" fontSize="18" fontWeight="bold">2020-2023</text>
                <text x="250" y="100" textAnchor="middle" fill="white" fontSize="16">행안부 신중년사업</text>
                <text x="250" y="170" textAnchor="middle" fill="#9ca3af" fontSize="14">4년</text>
                
                {/* 2024-2025 */}
                <circle cx="550" cy="125" r="8" fill="#3b82f6"/>
                <rect x="450" y="50" width="200" height="60" rx="10" fill="#374151"/>
                <text x="550" y="80" textAnchor="middle" fill="#3b82f6" fontSize="18" fontWeight="bold">2024-2025</text>
                <text x="550" y="100" textAnchor="middle" fill="white" fontSize="16">자체사업</text>
                <text x="550" y="170" textAnchor="middle" fill="#9ca3af" fontSize="14">2년</text>
                
                {/* 화살표 */}
                <path d="M 350 125 L 440 125" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow)"/>
              </svg>
              
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-xl text-center text-gray-300">
                  현장점검 사업 수행을 통해 파악된 문제점과 개선 필요사항
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 3: 현장점검 특이사항
    {
      id: 3,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-6 border-b border-red-500 pb-3">현장점검 특이사항</h2>
          
          {/* 3개 카드 그리드 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
              <h3 className="text-lg font-semibold text-red-400 mb-2">정보 불일치</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• 실제 신고 정보와 상이한 현장</li>
                <li>• 설치장소 불일치</li>
                <li>• 소유기관 불일치</li>
                <li>• 개방유무 정보 오류</li>
                <li>• 중복 신고</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
              <h3 className="text-lg font-semibold text-purple-400 mb-2">관리 사각지대</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• 구비의무기관 중심 관리</li>
                <li>• 구비 외 기관 관리 공백</li>
                <li>• 노인정, 양로원 등 소외</li>
                <li>• 취약계층 시설 관리 부재</li>
                <li>• 민간 설치 AED 파악 어려움</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">관리 개선 한계</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• 현장점검 후 인지 향상은 확인</li>
                <li>• 데이터상 관리 개선은 불투명</li>
                <li>• 민간 관리의 한계</li>
                <li>• 잦은 입퇴사로 업무 연속성 결여</li>
                <li>• 체계적 개선 프로세스 부재</li>
              </ul>
            </div>
          </div>
          
          {/* 핵심 문제 요약 */}
          <div className="bg-gray-800 rounded-lg p-3 mb-4">
            <p className="text-center text-gray-300 text-sm font-medium">
              현장 점검은 지속되나 실질적 개선으로 이어지지 못하는 구조적 문제 발생
            </p>
          </div>
          
          {/* 일러스트레이션 영역 */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-full max-w-2xl">
              <svg viewBox="0 0 800 400" className="w-full h-full">
                {/* 배경 */}
                <rect x="0" y="0" width="800" height="400" fill="#1f2937" rx="10"/>
                
                {/* First Aid 박스 */}
                <g transform="translate(100, 50)">
                  {/* 박스 본체 */}
                  <rect x="0" y="50" width="250" height="180" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="3" rx="5"/>
                  <rect x="15" y="65" width="220" height="150" fill="#cbd5e1" rx="3"/>
                  
                  {/* First Aid 표지판 */}
                  <rect x="50" y="20" width="150" height="40" fill="#10b981" rx="3"/>
                  <text x="125" y="45" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">FIRST AID</text>
                  
                  {/* 왼쪽 수납공간 */}
                  <rect x="25" y="75" width="100" height="130" fill="#94a3b8" stroke="#64748b" strokeWidth="2" rx="3"/>
                  
                  {/* 오른쪽 문 - 열려있는 상태 */}
                  <g transform="rotate(-25, 135, 140)">
                    <rect x="135" y="75" width="90" height="130" fill="#f3f4f6" stroke="#64748b" strokeWidth="2" rx="3"/>
                    <rect x="145" y="85" width="70" height="60" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="1"/>
                    <rect x="180" y="160" width="15" height="25" fill="#64748b" rx="2"/>
                  </g>
                  
                  {/* 의료 용품 아이콘 */}
                  <g transform="translate(45, 110)">
                    {/* 반창고 */}
                    <rect x="0" y="0" width="25" height="25" fill="#fef3c7" rx="3"/>
                    <rect x="10" y="5" width="5" height="15" fill="#d97706"/>
                    <rect x="5" y="10" width="15" height="5" fill="#d97706"/>
                  </g>
                  
                  <g transform="translate(85, 110)">
                    {/* 약병 */}
                    <rect x="0" y="5" width="20" height="25" fill="#dbeafe" rx="3"/>
                    <rect x="0" y="0" width="20" height="8" fill="#60a5fa" rx="3"/>
                    <circle cx="10" cy="18" r="5" fill="#3b82f6"/>
                  </g>
                </g>
                
                {/* 파손되어 방치된 AED 박스 */}
                <g transform="translate(400, 180)">
                  {/* 바닥에 기울어진 AED 박스 */}
                  <g transform="rotate(15, 60, 90)">
                    <rect x="0" y="50" width="120" height="120" fill="#d1d5db" stroke="#6b7280" strokeWidth="3" rx="5"/>
                    {/* 깨진 스크린 */}
                    <rect x="15" y="65" width="90" height="90" fill="#4b5563" rx="3"/>
                    {/* 균열 표시 */}
                    <path d="M 30 80 L 50 100 L 45 120 L 60 110 L 80 130" stroke="#ef4444" strokeWidth="2" fill="none"/>
                    <path d="M 70 75 L 85 90 L 75 105" stroke="#ef4444" strokeWidth="2" fill="none"/>
                    
                    {/* AED 표시 - 희미하게 */}
                    <text x="60" y="115" textAnchor="middle" fill="#9ca3af" fontSize="16" opacity="0.5">AED</text>
                  </g>
                  
                  {/* 떨어진 패드 */}
                  <g transform="translate(140, 100)">
                    <ellipse cx="0" cy="0" rx="25" ry="20" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2"/>
                    <rect x="-8" y="-8" width="16" height="16" fill="#fbbf24" rx="2"/>
                  </g>
                  
                  {/* 먼지와 거미줄 효과 */}
                  <path d="M 0 30 Q 20 35 40 30" stroke="#6b7280" strokeWidth="1" opacity="0.3"/>
                  <path d="M 100 20 Q 120 25 140 20" stroke="#6b7280" strokeWidth="1" opacity="0.3"/>
                  <circle cx="30" cy="35" r="1" fill="#6b7280" opacity="0.5"/>
                  <circle cx="110" cy="45" r="1" fill="#6b7280" opacity="0.5"/>
                  
                  {/* 경고 표시 */}
                  <g transform="translate(-50, -20)">
                    <path d="M 0 0 L 10 -20 L 20 0 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
                    <text x="10" y="-5" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">!</text>
                  </g>
                  
                  {/* 바닥 그림자 */}
                  <ellipse cx="60" cy="180" rx="80" ry="15" fill="#000000" opacity="0.2"/>
                </g>
                
                {/* 추가 배경 요소 - 벽의 균열 */}
                <path d="M 550 100 L 555 120 L 545 140 L 550 160" stroke="#4b5563" strokeWidth="1" opacity="0.5"/>
                <path d="M 600 150 L 605 170 L 595 190" stroke="#4b5563" strokeWidth="1" opacity="0.5"/>
              </svg>
            </div>
          </div>
        </div>
      )
    },
    // Slide 4: 공무원 인사이동 문제
    {
      id: 4,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-blue-500 pb-4">공무원 인사이동에 따른 연속성 문제</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-5xl">
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 rounded-lg p-6">
                  <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-4">
                    <circle cx="50" cy="50" r="35" fill="#3b82f6" opacity="0.3"/>
                    <rect x="35" y="35" width="30" height="30" fill="#3b82f6"/>
                  </svg>
                  <h3 className="text-xl font-semibold text-white mb-2 text-center">담당 부서</h3>
                  <p className="text-base text-gray-300 text-center">보건소 의약팀<br/>또는 응급팀</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-4">
                    <circle cx="50" cy="50" r="35" fill="#eab308" opacity="0.3"/>
                    <path d="M 30 70 L 30 50 L 45 50 L 45 70 M 55 70 L 55 40 L 70 40 L 70 70" fill="#eab308"/>
                  </svg>
                  <h3 className="text-xl font-semibold text-white mb-2 text-center">업무 우선순위</h3>
                  <p className="text-base text-gray-300 text-center">방사선 진단 등<br/>민원처리 우선</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-4">
                    <circle cx="50" cy="50" r="35" fill="#ef4444" opacity="0.3"/>
                    <path d="M 35 35 L 65 65 M 65 35 L 35 65" stroke="#ef4444" strokeWidth="4"/>
                  </svg>
                  <h3 className="text-xl font-semibold text-white mb-2 text-center">AED 업무</h3>
                  <p className="text-base text-gray-300 text-center">민원사무 처리<br/>급급한 현실</p>
                </div>
              </div>
              
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6">
                <p className="text-xl text-center text-gray-300">
                  잦은 인사이동으로 인한 업무 연속성 단절과 전문성 부재
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 5: 데이터 파악의 어려움
    {
      id: 5,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-purple-500 pb-4">AED 통계 데이터 파악의 어려움</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-5xl">
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-gray-800 rounded-lg p-6 border-2 border-red-500/50">
                  <h3 className="text-xl font-semibold text-red-400 mb-4">현재 시스템 문제</h3>
                  <ul className="space-y-3 text-lg text-gray-300">
                    <li>• 복잡 다양한 AED 데이터</li>
                    <li>• 이해하기 어려운 구조</li>
                    <li>• 현황 파악 불가능</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500/50">
                  <h3 className="text-xl font-semibold text-green-400 mb-4">필요한 기능</h3>
                  <ul className="space-y-3 text-lg text-gray-300">
                    <li>• 지역 내 설치 분포</li>
                    <li>• 관리 상태 현황</li>
                    <li>• 유효기간 파악</li>
                    <li>• 문제점 한눈에 파악</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg p-6">
                <p className="text-xl text-center text-gray-300">
                  담당자가 쉽게 이해하고 활용할 수 있는 시스템 필요
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 6: 개선단계의 중요성
    {
      id: 6,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-green-500 pb-4">결국 주요점은 개선단계</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-5xl">
              <svg viewBox="0 0 800 300" className="w-full mb-8">
                <defs>
                  <linearGradient id="processGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6"/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8"/>
                  </linearGradient>
                  <linearGradient id="processGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6"/>
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8"/>
                  </linearGradient>
                  <linearGradient id="processGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.6"/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.8"/>
                  </linearGradient>
                  <linearGradient id="processGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.6"/>
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8"/>
                  </linearGradient>
                  <filter id="softShadow">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                    <feOffset dx="0" dy="4" result="offsetblur"/>
                    <feFlood floodColor="#000000" floodOpacity="0.2"/>
                    <feComposite in2="offsetblur" operator="in"/>
                    <feMerge>
                      <feMergeNode/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Process boxes with modern gradient design */}
                <rect x="50" y="100" width="140" height="80" rx="15" fill="url(#processGrad1)" filter="url(#softShadow)"/>
                <text x="120" y="145" textAnchor="middle" fill="white" fontSize="16" fontWeight="500">현장점검</text>
                
                {/* Modern arrow design */}
                <g>
                  <path d="M 190 140 L 245 140" stroke="#6b7280" strokeWidth="2" strokeDasharray="5,5" opacity="0.3"/>
                  <path d="M 235 135 L 245 140 L 235 145" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                
                <rect x="250" y="100" width="140" height="80" rx="15" fill="url(#processGrad2)" filter="url(#softShadow)"/>
                <text x="320" y="135" textAnchor="middle" fill="white" fontSize="14" fontWeight="500">데이터 기반</text>
                <text x="320" y="155" textAnchor="middle" fill="white" fontSize="14" fontWeight="500">문제점 도출</text>
                
                <g>
                  <path d="M 390 140 L 445 140" stroke="#6b7280" strokeWidth="2" strokeDasharray="5,5" opacity="0.3"/>
                  <path d="M 435 135 L 445 140 L 435 145" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                
                <rect x="450" y="100" width="140" height="80" rx="15" fill="url(#processGrad3)" filter="url(#softShadow)"/>
                <text x="520" y="145" textAnchor="middle" fill="white" fontSize="16" fontWeight="500">지속 해결</text>
                
                <g>
                  <path d="M 590 140 L 645 140" stroke="#6b7280" strokeWidth="2" strokeDasharray="5,5" opacity="0.3"/>
                  <path d="M 635 135 L 645 140 L 635 145" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                
                <rect x="650" y="100" width="100" height="80" rx="15" fill="url(#processGrad4)" filter="url(#softShadow)"/>
                <text x="700" y="145" textAnchor="middle" fill="white" fontSize="16" fontWeight="500">관심</text>
                
                {/* Subtle connecting line underneath */}
                <path d="M 120 190 Q 400 210 700 190" stroke="#374151" strokeWidth="1" opacity="0.2"/>
              </svg>
              
              <div className="space-y-4">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-5">
                  <p className="text-lg text-gray-300">
                    현실적 여건상 시스템 뒷받침이 없으면 사장되는 현상 반복
                  </p>
                </div>
                
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-5">
                  <p className="text-lg text-gray-300">
                    담당자가 손쉽게 문제점과 개선 유무를 파악할 수 있는 시스템 도입 절실
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 7: 보급과 관리의 이원화
    {
      id: 7,
      content: (
        <div className="h-full flex flex-col">
          <h2 className="text-4xl font-bold text-white mb-8 border-b border-orange-500 pb-4">지자체 보급과 관리의 이원화</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-5xl">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-orange-400 mb-4">현재 문제점</h3>
                  <ul className="space-y-3 text-lg text-gray-300">
                    <li>• 보급정책 시 관리부서 의견 미반영</li>
                    <li>• 효율적 설치 지역 파악 어려움</li>
                  </ul>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-green-400 mb-4">향후 방향</h3>
                  <div className="space-y-3 text-lg text-gray-300">
                    <p>데이터 기반 설치 확대:</p>
                    <ul className="ml-4 space-y-2">
                      <li>• 유동인구 분석</li>
                      <li>• 심정지 환자 발생 기준</li>
                      <li>• 지역 추천 시스템</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6">
                <p className="text-xl text-center text-gray-300">
                  보급과 관리의 통합적 접근 필요
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 8: 결론
    {
      id: 8,
      content: (
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-5xl font-bold text-white mb-10">결론</h1>
          
          <div className="bg-gray-800 rounded-lg p-8 max-w-4xl mb-10">
            <p className="text-xl text-gray-300 leading-relaxed text-center">
              현장점검 이후 조사된 데이터를 기반으로 지역 내 문제점을 도출하고,
              발견된 문제점을 지속 해결하는 시스템 구축이 필요
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center">
              <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-3">
                <circle cx="50" cy="50" r="40" fill="#10b981" opacity="0.3"/>
                <circle cx="50" cy="50" r="30" fill="#10b981"/>
              </svg>
              <p className="text-lg text-gray-300">데이터 기반<br/>문제점 도출</p>
            </div>
            
            <div className="text-center">
              <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-3">
                <circle cx="50" cy="50" r="40" fill="#3b82f6" opacity="0.3"/>
                <circle cx="50" cy="50" r="30" fill="#3b82f6"/>
              </svg>
              <p className="text-lg text-gray-300">담당자 친화적<br/>시스템</p>
            </div>
            
            <div className="text-center">
              <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-3">
                <circle cx="50" cy="50" r="40" fill="#a855f7" opacity="0.3"/>
                <circle cx="50" cy="50" r="30" fill="#a855f7"/>
              </svg>
              <p className="text-lg text-gray-300">지속적<br/>개선 관리</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      {/* Slide Container - 16:9 ratio */}
      <div className="w-full max-w-[1600px] mx-auto px-8">
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
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
      </div>
      
      {/* Keyboard hints */}
      <div className="fixed top-4 right-4 text-gray-500 text-sm">
        <p>← → 화살표키로 이동</p>
      </div>
    </div>
  );
}