import Link from "next/link";
import HomeClient from '@/components/HomeClient';

export default function Home() {
  // 하드코딩된 통계 정보 - 성능 최적화를 위해 실시간 조회 제거
  const stats = {
    totalDevices: 80766,     // 전체 AED 장비 수
    totalHealthCenters: 261, // 전국 보건소 수
    totalProvinces: 17,      // 시도 수
    monitoring: '24/7'       // 모니터링 상태
  };

  const features = [
    {
      icon: "hospital",
      title: "보건소 현지 점검",
      description: "전국 260여개 보건소의 AED를 점검을 스마트하게 관리합니다"
    },
    {
      icon: "mobile",
      title: "모바일 최적화",
      description: "언제 어디서나 스마트폰으로 점검 업무를 수행할 수 있습니다",
      link: "/presentation4"
    },
    {
      icon: "map",
      title: "위치 기반 점검",
      description: "GPS와 지도를 활용한 정확한 AED 위치 관리 시스템"
    },
    {
      icon: "chart",
      title: "지능형 우선순위 관리",
      description: "5단계 분류 시스템으로 긴급도에 따른 효율적인 점검 스케줄링"
    },
    {
      icon: "sync",
      title: "e-Gen 데이터 연동",
      description: "중앙응급의료센터 E-gen 시스템과 장비 동기화"
    },
    {
      icon: "report",
      title: "통계 및 보고서",
      description: "월간, 분기, 연간 보고서 자동 생성 및 데이터 분석"
    }
  ];

  const statsDisplay = [
    {
      number: stats.totalDevices.toLocaleString(),
      label: "AED 장비",
      color: "text-green-400"
    },
    {
      number: stats.totalHealthCenters.toString(),
      label: "보건소",
      color: "text-emerald-400"
    },
    {
      number: stats.totalProvinces.toString(),
      label: "시도",
      color: "text-teal-400"
    },
    {
      number: stats.monitoring,
      label: "모니터링",
      color: "text-lime-400"
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Mobile-optimized Hero Section */}
      <section className="relative min-h-[calc(100vh-80px)] md:min-h-0 flex flex-col justify-center md:block">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-600/10 to-teal-600/10" />
        <div className="relative container mx-auto px-4 py-8 md:py-16">
          {/* Mobile Layout - Single Column, Desktop - Two Columns */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Main Content - Always Visible */}
            <div className="text-center lg:text-left">
              {/* Logo */}
              <div className="flex justify-center lg:justify-start mb-6 md:mb-8">
                <div className="relative w-24 h-24 md:w-32 md:h-32" role="img" aria-label="AED Smart Check 로고">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse opacity-50" />
                  <div className="relative flex items-center justify-center w-full h-full bg-green-500 rounded-full">
                    <svg className="w-16 h-16 md:w-20 md:h-20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      {/* White heart shape */}
                      <path d="M50 85C50 85 20 60 20 40C20 30 25 25 32 25C38 25 44 28 50 35C56 28 62 25 68 25C75 25 80 30 80 40C80 60 50 85 50 85Z" fill="white"/>
                      {/* Green lightning bolt */}
                      <path d="M55 35L45 50H55L40 65L60 45H50L55 35Z" fill="#10b981" strokeWidth="2" stroke="#10b981"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Title - 모바일과 PC 다르게 표시 */}
              <div className="md:hidden">
                {/* 모바일: 두 줄로 표시 */}
                <h1 className="text-3xl font-bold text-white mb-4" role="heading" aria-level={1}>
                  <span className="text-white">AED 픽스</span>
                </h1>
                <div className="text-2xl font-semibold mb-6 tracking-wide">
                  <span className="text-white text-2xl">aed.pics</span>
                  <span className="text-white text-lg">(</span>
                  <span className="text-yellow-300 font-bold text-xl">AED</span>
                  <span className="text-white text-lg"> </span>
                  <span className="text-yellow-300 font-bold text-xl">pic</span>
                  <span className="text-white text-base">k </span>
                  <span className="text-white text-base">up </span>
                  <span className="text-yellow-300 font-bold text-xl">s</span>
                  <span className="text-white text-base">ystem</span>
                  <span className="text-white text-lg">)</span>
                </div>
              </div>

              <div className="hidden md:block">
                {/* PC: 한 줄로 표시 */}
                <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 flex flex-wrap items-baseline gap-4" role="heading" aria-level={1}>
                  <span className="text-white">AED 픽스</span>
                  <span className="text-3xl lg:text-4xl font-semibold">
                    <span className="text-white">aed.pics</span>
                    <span className="text-white text-xl lg:text-2xl">(</span>
                    <span className="text-yellow-300 font-bold text-2xl lg:text-3xl">AED</span>
                    <span className="text-white text-xl lg:text-2xl"> </span>
                    <span className="text-yellow-300 font-bold text-2xl lg:text-3xl">pic</span>
                    <span className="text-white text-lg lg:text-xl">k </span>
                    <span className="text-white text-lg lg:text-xl">up </span>
                    <span className="text-yellow-300 font-bold text-2xl lg:text-3xl">s</span>
                    <span className="text-white text-lg lg:text-xl">ystem</span>
                    <span className="text-white text-xl lg:text-2xl">)</span>
                  </span>
                </h1>
              </div>


              {/* Action Buttons */}
              <div className="flex flex-row gap-2 md:gap-4 justify-center lg:justify-start mb-6 md:mb-8" role="navigation" aria-label="주요 행동">
                <Link
                  href="/tutorial-guide"
                  className="flex-1 sm:flex-none px-3 py-3 md:px-6 md:py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-all md:transform md:hover:scale-105 shadow-lg text-xs sm:text-sm md:text-base text-center"
                  aria-label="점검체험하기 - 인터랙티브 튜토리얼 페이지로 이동"
                >
                  점검체험하기
                </Link>
                <Link
                  href="/auth/signin"
                  className="flex-1 sm:flex-none px-3 py-3 md:px-6 md:py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-all md:transform md:hover:scale-105 shadow-lg text-xs sm:text-sm md:text-base text-center"
                  aria-label="로그인 - 로그인 페이지로 이동"
                >
                  로그인
                </Link>
                <Link
                  href="/auth/signup"
                  className="flex-1 sm:flex-none px-3 py-3 md:px-6 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all md:transform md:hover:scale-105 shadow-lg text-xs sm:text-sm md:text-base text-center"
                  aria-label="회원가입 - 회원가입 페이지로 이동"
                >
                  회원가입
                </Link>
              </div>

              {/* Quick Stats - 모바일과 데스크톱 모두 표시 */}
              <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-md mx-auto lg:mx-0">
                <div className="bg-gray-800/50 rounded-lg p-3 md:p-4 flex flex-col items-center">
                  <svg className="w-8 h-8 md:w-10 md:h-10 text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-white text-sm md:text-base font-semibold text-center">일정 관리</div>
                  <div className="text-gray-400 text-xs md:text-sm text-center">점검대상을 추가하고</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 md:p-4 flex flex-col items-center">
                  <svg className="w-8 h-8 md:w-10 md:h-10 text-emerald-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-white text-sm md:text-base font-semibold text-center">현장 점검</div>
                  <div className="text-gray-400 text-xs md:text-sm text-center">추가된 장비를 점검하기</div>
                </div>
              </div>
            </div>

            {/* Phone Mockup - Hidden on mobile */}
            <div className="hidden lg:flex justify-center lg:justify-end">
              <div className="relative">
                {/* Phone Frame */}
                <div className="relative w-80 h-[650px] bg-black rounded-[3rem] p-3 shadow-2xl">
                  <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-24 h-6 bg-black rounded-full"></div>
                  <div className="w-full h-full bg-gradient-to-b from-green-500 to-emerald-600 rounded-[2.5rem] overflow-hidden">
                    {/* Phone Screen Content */}
                    <div className="p-6 text-white">
                      {/* Status Bar */}
                      <div className="flex justify-between items-center mb-6 text-sm">
                        <span>05:30</span>
                        <div className="flex gap-1">
                          <div className="w-4 h-3 bg-white rounded-sm"></div>
                          <div className="w-4 h-3 bg-white rounded-sm"></div>
                          <div className="w-4 h-3 bg-white rounded-sm"></div>
                        </div>
                      </div>

                      {/* App Header */}
                      <div className="text-center mb-8">
                        <h2 className="text-xl font-semibold mb-2">AED 픽스</h2>
                        <div className="w-20 h-20 mx-auto bg-white/60 rounded-2xl flex items-center justify-center">
                          <svg className="w-18 h-18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* 녹색 하트 모양 - 최대한 크게 */}
                            <path d="M50 95C50 95 10 65 10 35C10 18 18 10 32 10C42 10 48 16 50 25C52 16 58 10 68 10C82 10 90 18 90 35C90 65 50 95 50 95Z" fill="#10b981"/>
                            {/* 흰색 번개 - 최대한 크게 */}
                            <path d="M60 25L40 50H55L35 72L68 42H50L60 25Z" fill="white" strokeWidth="3" stroke="white"/>
                          </svg>
                        </div>
                        <p className="mt-4 text-lg font-bold whitespace-nowrap">자동심장충격기 현지점검</p>
                        <p className="text-sm opacity-80">최근 점검: Today, 10:30 AM</p>
                      </div>

                      {/* Status Cards */}
                      <div className="space-y-3">
                        <div className="bg-white/10 rounded-xl p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">패드 유효기간:</span>
                            <span className="text-lg font-bold">3개월 남음</span>
                          </div>
                          <div className="mt-2 w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white h-2 rounded-full" style={{width: '98%'}}></div>
                          </div>
                        </div>

                        <div className="bg-white/10 rounded-xl p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">제조 년월일</span>
                            <span className="text-sm">1981.5.30</span>
                          </div>
                        </div>

                        <button className="w-full bg-white/20 rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-white/30 transition-colors">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm font-semibold">장비시리얼 번호</span>
                        </button>
                      </div>

                      {/* Map Preview */}
                      <div className="mt-6 bg-white/10 rounded-xl p-2 h-32">
                        <div className="w-full h-full bg-gray-700/50 rounded-lg flex items-center justify-center relative overflow-hidden">
                          {/* 심플한 지도 격자 무늬 */}
                          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            {/* 가로선 */}
                            <line x1="0" y1="33%" x2="100%" y2="33%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                            <line x1="0" y1="66%" x2="100%" y2="66%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                            {/* 세로선 */}
                            <line x1="33%" y1="0" x2="33%" y2="100%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                            <line x1="66%" y1="0" x2="66%" y2="100%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                          </svg>
                          <div className="text-center relative z-10">
                            <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs opacity-80">드래그하여 위치 수정</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Features Section - 모바일에서만 보이는 간단한 기능 소개 */}
      <section className="md:hidden py-8 bg-gray-800/30">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold text-center text-white mb-6">
            주요 기능
          </h2>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 flex items-center">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">모바일 점검</h3>
                <p className="text-gray-400 text-xs">스마트폰으로 현장 점검</p>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 flex items-center">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">위치 관리</h3>
                <p className="text-gray-400 text-xs">GPS 기반 AED 위치 추적</p>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 flex items-center">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">통계 분석</h3>
                <p className="text-gray-400 text-xs">실시간 점검 현황 및 보고서</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Hidden on mobile */}
      <section className="hidden md:block py-16 bg-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {statsDisplay.map((stat, index) => (
              <div key={index} className="text-center">
                <div className={`text-4xl md:text-5xl font-bold ${stat.color} mb-2`}>
                  {stat.number}
                </div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Hidden on mobile */}
      <section className="hidden md:block py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
            주요 기능
          </h2>
          
          <HomeClient features={features} />
        </div>
      </section>


      {/* Footer - Simplified for mobile */}
      <footer className="py-6 md:py-12 bg-gray-900 border-t border-gray-800 md:mt-0 mt-auto">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-400">
            <p className="text-xs md:text-base mb-1 md:mb-2">© 2025 AED 픽스 aed.pics</p>
            <p className="text-xs md:text-sm mb-4">
              보건소 자동심장충격기 현장점검등록지
            </p>
            <div className="flex justify-center space-x-4 text-xs">
              <Link href="/terms" className="hover:text-green-400 transition-colors">
                서비스 이용약관
              </Link>
              <span className="text-gray-600">|</span>
              <Link href="/privacy" className="hover:text-green-400 transition-colors">
                개인정보 처리방침
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
