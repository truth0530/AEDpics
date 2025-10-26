'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function AEDInstallationTargetsPage() {
  const router = useRouter();

  const mandatoryInstitutions = [
    {
      no: 1,
      target: '공공보건의료기관',
      law: '「공공보건의료에 관한 법률」 제2조 제3호',
      details: '보건소, 보건지소, 보건진료소, 공공병원 등'
    },
    {
      no: 2,
      target: '구급차 (소방청·의료기관 운용)',
      law: '「119구조·구급에 관한 법률」 제10조, 「의료법」 제3조',
      details: '119구급차, 병원 구급차, 응급환자 이송차량'
    },
    {
      no: 3,
      target: '여객 항공기 및 공항',
      law: '「항공안전법」 제2조 제1호, 「공항시설법」 제2조 제3호',
      details: '국내선·국제선 여객기, 공항 터미널'
    },
    {
      no: 4,
      target: '철도 객차',
      law: '「철도산업발전 기본법」 제3조 제4호',
      details: 'KTX, SRT, 무궁화호, ITX 등 모든 여객 열차'
    },
    {
      no: 5,
      target: '총톤수 20톤 이상 선박',
      law: '「선박법」 제1조의2 제1항 제1호·제2호',
      details: '여객선, 화물선, 어선 등 20톤 이상 모든 선박'
    },
    {
      no: 6,
      target: '대통령령으로 정한 규모 이상의 공동주택',
      law: '「건축법」 제2조 제2항 제2호 및 관계 대통령령',
      details: '500세대 이상 또는 16층 이상 공동주택'
    }
  ];

  const multiUseFacilities = [
    {
      no: 1,
      target: '철도역사 대합실',
      condition: '연면적 2,000㎡ 이상 또는 전년도 일일 평균 이용객 10,000명 이상',
      examples: '서울역, 부산역 등 주요 철도역'
    },
    {
      no: 2,
      target: '여객자동차터미널 대합실',
      condition: '연면적 2,000㎡ 이상 또는 전년도 일일 평균 이용객 3,000명 이상',
      examples: '고속버스터미널, 시외버스터미널'
    },
    {
      no: 3,
      target: '항만법상 대합실',
      condition: '연면적 2,000㎡ 이상 또는 전년도 일일 평균 이용객 1,000명 이상',
      examples: '여객선터미널, 국제여객터미널'
    },
    {
      no: 4,
      target: '카지노 영업장',
      condition: '전용면적 2,000㎡ 이상',
      examples: '강원랜드, 외국인전용카지노'
    },
    {
      no: 5,
      target: '경마장',
      condition: '「한국마사회법」 제4조',
      examples: '서울경마공원, 부산경남경마공원'
    },
    {
      no: 6,
      target: '경륜·경정 경주장',
      condition: '「경륜·경정법」 제5조 제1항',
      examples: '광명스피돔, 미사리경정장'
    },
    {
      no: 7,
      target: '교정·보호시설',
      condition: '관련 법령에 따른 모든 시설',
      examples: '교도소, 구치소, 소년원, 외국인보호소'
    },
    {
      no: 8,
      target: '전문체육시설',
      condition: '총 관람석 수 5,000석 이상',
      examples: '종합운동장, 야구장, 축구전용경기장'
    },
    {
      no: 9,
      target: '중앙행정기관 청사',
      condition: '보건복지부장관 지정 청사',
      examples: '정부서울청사, 정부세종청사'
    },
    {
      no: 10,
      target: '시·도 청사',
      condition: '보건복지부장관 지정 청사',
      examples: '서울시청, 경기도청 등 17개 시도청'
    }
  ];

  const checklistItems = [
    {
      title: '1단계: 법적 근거 확인',
      items: [
        '기관이 위 표의 설치 대상에 해당하는지 확인',
        '해당 법령 조항을 점검일지에 기록',
        '애매한 경우 관할 보건소 문의'
      ]
    },
    {
      title: '2단계: 설치 조건 검증',
      items: [
        '면적: 건축물대장 또는 관리사무소 확인',
        '이용객 수: 운영일지 또는 통계자료 확인',
        '좌석 수: 시설 도면 또는 현장 확인'
      ]
    },
    {
      title: '3단계: 증빙 자료 확보',
      items: [
        '시설 입구 간판 사진 촬영',
        '면적 표시판 또는 도면 사진',
        '이용객 통계 또는 좌석 배치도 사진'
      ]
    },
    {
      title: '4단계: 점검 기록',
      items: [
        '설치 의무 여부 명시',
        '판단 근거 상세 기록',
        '확인한 증빙자료 목록 작성'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                <span className="text-sm font-medium">점검 화면으로 돌아가기</span>
              </button>
              <h1 className="text-lg font-bold text-white">AED 설치 의무 대상 기준</h1>
            </div>
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-gray-400">자동심장충격기 설치 및 관리 지침(제7판)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Quick Reference */}
        <div className="bg-emerald-900/20 border border-emerald-600/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-emerald-400 mb-2">빠른 확인 가이드</h2>
              <p className="text-sm text-gray-300 mb-3">
                AED 설치 의무 대상은 크게 법령에 따른 의무 기관과 다중이용시설로 구분됩니다.
                아래 표를 참고하여 점검 대상 기관의 설치 의무 여부를 확인하세요.
              </p>
              <div className="flex flex-wrap gap-2">
                {['의료기관', '교통시설', '교육기관', '공공기관', '대규모시설'].map(tag => (
                  <span key={tag} className="px-3 py-1 bg-emerald-800/30 text-emerald-300 text-xs rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: 법령에 따른 설치 의무 기관 */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">1. 법령에 따른 설치 의무 기관</h3>
            <p className="text-sm text-gray-400 mt-1">응급의료에 관한 법률 제47조의2 제1항 제1호~제6호</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium w-12">번호</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">설치 대상</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">관련 법령</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">세부 사항</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {mandatoryInstitutions.map(item => (
                  <tr key={item.no} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{item.no}</td>
                    <td className="px-4 py-3 text-white font-medium">{item.target}</td>
                    <td className="px-4 py-3 text-gray-300">{item.law}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{item.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: 다중이용시설 */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">2. 다중이용시설 설치 의무</h3>
            <p className="text-sm text-gray-400 mt-1">응급의료에 관한 법률 제47조의2 제1항 제7호 및 시행령 제26조의5 제3항</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium w-12">번호</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">시설</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">설치 요건</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-medium">예시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {multiUseFacilities.map(item => (
                  <tr key={item.no} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{item.no}</td>
                    <td className="px-4 py-3 text-white font-medium">{item.target}</td>
                    <td className="px-4 py-3 text-gray-300">
                      <span className="inline-block px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded">
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{item.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: 현장 점검 체크리스트 */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">현장 점검 체크리스트</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checklistItems.map((item, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
                <div className="mb-3">
                  <h4 className="font-medium text-white">{item.title}</h4>
                </div>
                <ul className="space-y-2">
                  {item.items.map((subItem, subIdx) => (
                    <li key={subIdx} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span className="text-sm text-gray-300">{subItem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Important Notes */}
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-400 mb-3">중요 참고사항</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>설치 의무 대상 여부가 불명확한 경우, 관할 보건소 또는 보건복지부에 질의하여 확인</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>면적 기준은 연면적(건물 전체) 또는 전용면적(해당 시설)을 정확히 구분하여 적용</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>이용객 수는 전년도 통계 자료를 기준으로 하며, 신규 시설은 예상 이용객 수로 판단</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>공동주택의 경우 500세대 이상 또는 16층 이상 중 하나만 충족해도 설치 의무 대상</span>
            </li>
          </ul>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
          >
            ← 점검 화면으로 돌아가기
          </button>
          <div className="text-sm text-gray-500">
            최종 업데이트: 2025년 1월 (제7판 기준)
          </div>
        </div>
      </div>
    </div>
  );
}