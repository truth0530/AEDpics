'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// SVG Icon Components
const ClockIcon = () => (
  <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-16 h-16 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-16 h-16 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const RocketIcon = () => (
  <svg className="w-20 h-20 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-20 h-20 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const CycleIcon = () => (
  <svg className="w-20 h-20 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const XIcon = () => (
  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ArrowIcon = () => (
  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default function Presentation3Page() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();
  const totalSlides = 6;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
        setCurrentSlide(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        setCurrentSlide(prev => prev - 1);
      } else if (e.key === 'Escape') {
        router.push('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, router]);

  const slides = [
    {
      id: 1,
      content: (
        <div className="flex flex-col h-full justify-center items-center text-center">
          <h1 className="text-7xl font-bold text-white mb-4 leading-tight">
            AED 픽스
          </h1>
          <div className="text-4xl font-semibold mb-8 tracking-wide">
            <span className="text-white text-4xl">aed.pics</span>
            <span className="text-white text-2xl">(</span>
            <span className="text-yellow-300 font-bold text-3xl">AED</span>
            <span className="text-white text-2xl"> </span>
            <span className="text-yellow-300 font-bold text-3xl">pic</span>
            <span className="text-white text-xl">k </span>
            <span className="text-white text-xl">up </span>
            <span className="text-yellow-300 font-bold text-3xl">s</span>
            <span className="text-white text-xl">ystem</span>
            <span className="text-white text-2xl">)</span>
          </div>
          <p className="text-4xl text-gray-300 mb-12">
            현장점검의 3가지 문제 
          </p>
          <div className="space-y-3 text-xl text-gray-400">
            <p className="font-semibold">중앙응급의료센터</p>
            <p className="text-gray-500">대구 인천 세종 응급의료지원센터</p>
          </div>
        </div>
      )
    },
    {
      id: 2,
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-5xl font-bold text-white mb-12 text-center">
            기존 점검의 구조적 한계
          </h2>
          <div className="grid grid-cols-3 gap-8">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-all">
              <div className="mb-6 flex justify-center">
                <ClockIcon />
              </div>
              <h3 className="text-2xl font-bold text-amber-400 mb-4">
                현장 도착후 문제 파악
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                현장을 파악하고 장비의 문제점 인지
                <span className="text-amber-400 font-bold"> 시간이 지연</span>됨
              </p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-all">
              <div className="mb-6 flex justify-center">
                <DocumentIcon />
              </div>
              <h3 className="text-2xl font-bold text-sky-400 mb-4">
                과도한 기본정보 입력
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                설치기관명, 관리번호, 장비연번 등 작성항목 과다
                <span className="text-sky-400 font-bold"> 중복, 오류</span>
              </p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-all">
              <div className="mb-6 flex justify-center">
                <RefreshIcon />
              </div>
              <h3 className="text-2xl font-bold text-rose-400 mb-4">
                점검 결과 활용 미흡
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                점검 내용은 복지부 제출용, 현장과 시스템 반영은 후순위
                <span className="text-rose-400 font-bold"> 데이터 이원화</span>지속
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-5xl font-bold text-white mb-12 text-center">
            개선 1. 한눈에 파악하는 정보
          </h2>
          <div className="grid grid-cols-2 gap-10">
            <div className="flex flex-col justify-center">
              <div className="bg-red-900/20 border-2 border-red-500/50 rounded-2xl p-10">
                <h3 className="text-3xl text-red-400 font-bold mb-6 flex items-center">
                  <XIcon />
                  <span className="ml-3">기존의 문제점</span>
                </h3>
                <p className="text-gray-300 text-xl leading-relaxed">
                  현장의 비협조적인 담당자 소통, 장비 위치, 상태, 유효기간 등 정보 파악을 위한
                  초기 대응 시간이 지연됨
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="bg-emerald-900/20 border-2 border-emerald-500/50 rounded-2xl p-10">
                <h3 className="text-3xl text-emerald-400 font-bold mb-6 flex items-center">
                  <CheckIcon />
                  <span className="ml-3">문제점 한눈에 요약</span>
                </h3>
                <ul className="space-y-4 text-gray-200 text-xl">
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">핵심 경보와 우선순위 파악</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">최근 점검일, 유효기간 문제, 제조번호중복등 미리 파악</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 4,
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-5xl font-bold text-white mb-12 text-center">
            개선 2. 기본정보 입력 최소화
          </h2>
          <div className="grid grid-cols-2 gap-10">
            <div className="flex flex-col justify-center">
              <div className="bg-red-900/20 border-2 border-red-500/50 rounded-2xl p-10">
                <h3 className="text-3xl text-red-400 font-bold mb-6 flex items-center">
                  <XIcon />
                  <span className="ml-3">기존의 문제점</span>
                </h3>
                <p className="text-gray-300 text-xl leading-relaxed">
                  수기로 입력하는 기본 정보가 많아 현장에서 행정 시간이 늘어나고,
                  현장에서 체크한 내용을 사무실에서 다시 정리해야 하는 어려움, 입력 오류
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="bg-emerald-900/20 border-2 border-emerald-500/50 rounded-2xl p-10">
                <h3 className="text-3xl text-emerald-400 font-bold mb-6 flex items-center">
                  <CheckIcon />
                  <span className="ml-3">점검과 제출 원스톱</span>
                </h3>
                <ul className="space-y-4 text-gray-200 text-xl">
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">사전에 등록된 기관·장비 정보를 자동 불러와 &apos;입력 최소화 &apos;</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">일치 버튼, 필요시 오류 정보 수정만 하여 점검에 집중</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">모바일 기반의 UI최적화로 사무실 복귀후 결과 제출업무 생략</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 5,
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-5xl font-bold text-white mb-12 text-center">
            개선 3. 데이터 기반 연계와 활용
          </h2>
          <div className="grid grid-cols-2 gap-10">
            <div className="flex flex-col justify-center">
              <div className="bg-red-900/20 border-2 border-red-500/50 rounded-2xl p-10">
                <h3 className="text-3xl text-red-400 font-bold mb-6 flex items-center">
                  <XIcon />
                  <span className="ml-3">기존의 문제점</span>
                </h3>
                <p className="text-gray-300 text-xl leading-relaxed">
                  복지부로 제출할 점검결과 취합, 제출에 중점을 두고, 엑셀파일의 결과는 현장, 보건소 실제 업무에 연계하기 어려운 문제가 방치된 수준
                  
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="bg-emerald-900/20 border-2 border-emerald-500/50 rounded-2xl p-10">
                <h3 className="text-3xl text-emerald-400 font-bold mb-6 flex items-center">
                  <CheckIcon />
                  <span className="ml-3">점검결과 실제정보 연계</span>
                </h3>
                <ul className="space-y-4 text-gray-200 text-xl">
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">현장에서 즉석 권고할 내용과 사무실 복귀 후 새올 시스템 수정에 필요한 정보 실시간 제공</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">수정이 필요한 장비만 자동 추출해 후속 조치 목록 제공</span>
                  </li>
                  <li className="flex items-start">
                    <ArrowIcon />
                    <span className="ml-3">점검결과 취합 제출 생략으로 실제 정보와 연계강화</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 6,
      content: (
        <div className="h-full flex flex-col justify-center items-center">
          <h2 className="text-6xl font-bold text-white mb-16 text-center">
            AED 픽스 효과
          </h2>
          <div className="grid grid-cols-3 gap-10 w-full max-w-7xl mb-16">
            <div className="bg-gray-800/50 border-2 border-emerald-500/60 rounded-2xl p-10 hover:border-emerald-400 transition-all">
              <div className="mb-6 flex justify-center">
                <RocketIcon />
              </div>
              <p className="text-emerald-400 text-2xl font-bold mb-4 text-center">
                현장 효율 향상
              </p>
              <p className="text-gray-200 text-lg text-center leading-relaxed">
                점검 준비 시간 <span className="text-emerald-400 font-bold"> 절감</span><br/>
                우선순위 점검 완료율 <span className="text-emerald-400 font-bold"> 증가</span>
              </p>
            </div>
            <div className="bg-gray-800/50 border-2 border-sky-500/60 rounded-2xl p-10 hover:border-sky-400 transition-all">
              <div className="mb-6 flex justify-center">
                <ChartIcon />
              </div>
              <p className="text-sky-400 text-2xl font-bold mb-4 text-center">
                정확한 데이터
              </p>
              <p className="text-gray-200 text-lg text-center leading-relaxed">
                기본 정보 입력 오류율 <span className="text-sky-400 font-bold"> 감소</span><br/>
                기관별 이력 관리 <span className="text-sky-400 font-bold">자동화</span>
              </p>
            </div>
            <div className="bg-gray-800/50 border-2 border-rose-500/60 rounded-2xl p-10 hover:border-rose-400 transition-all">
              <div className="mb-6 flex justify-center">
                <CycleIcon />
              </div>
              <p className="text-rose-400 text-2xl font-bold mb-4 text-center">
                지속적 질 관리
              </p>
              <p className="text-gray-200 text-lg text-center leading-relaxed">
                점검→지도→개선까지<br/>
                <span className="text-rose-400 font-bold">단일 플랫폼</span>에서 관리 가능
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-4 rounded-full border-2 border-gray-600 text-gray-300 hover:text-white hover:border-white transition-all text-lg font-semibold"
          >
            메인으로 돌아가기
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      <div className="w-full max-w-[1600px] mx-auto px-8">
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl p-16 overflow-hidden">
            {slides[currentSlide].content}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-900/90 backdrop-blur px-6 py-3 rounded-full">
        <button
          onClick={() => currentSlide > 0 && setCurrentSlide(prev => prev - 1)}
          className="text-white hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                index === currentSlide ? 'bg-emerald-400 w-8' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>

        <span className="text-white mx-4">{currentSlide + 1} / {totalSlides}</span>

        <button
          onClick={() => currentSlide < totalSlides - 1 && setCurrentSlide(prev => prev + 1)}
          className="text-white hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Keyboard Hints */}
      <div className="fixed top-4 right-4 text-gray-500 text-sm">
        <p>← → 화살표키로 이동</p>
        <p>ESC 누르면 메인으로 이동</p>
      </div>
    </div>
  );
}
