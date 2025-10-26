'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CubeIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function AEDStorageSpecificationsPage() {
  const router = useRouter();

  const storageTypes = [
    {
      type: '벽걸이형',
      dimensions: {
        width: '40cm',
        height: '30cm',
        depth: '30cm'
      },
      features: [
        '벽면 부착 설치',
        '공간 효율적',
        '실내 설치 적합',
        '높이 조절 가능'
      ]
    },
    {
      type: '스탠드형',
      dimensions: {
        width: '40cm',
        height: '160cm',
        depth: '30cm'
      },
      features: [
        '독립형 설치',
        '2단 구조',
        '이동 가능',
        '실내외 겸용'
      ]
    }
  ];

  const commonRequirements = [
    {
      category: '재질',
      requirements: [
        '본체: 철재 재질',
        '전면부: 투명 아크릴판',
        '내구성 및 방수 처리',
        '부식 방지 코팅'
      ]
    },
    {
      category: '보안장치',
      requirements: [
        '도난 경보장치 필수',
        '문 개방시 경고음 발생',
        '관리책임자 실시간 통보 기능',
        '비상 개방 장치'
      ]
    },
    {
      category: '표시사항',
      requirements: [
        '자동심장충격기 표시 (한글/영문)',
        'AED 사용방법 (그림 포함)',
        '관리책임자 연락처',
        '응급 연락처 119'
      ]
    },
    {
      category: '설치환경',
      requirements: [
        '온도: 0°C ~ 43°C',
        '습도: 5% ~ 95%',
        '직사광선 차단',
        '우천시 방수'
      ]
    }
  ];

  const displayRequirements = {
    front: [
      '자동심장충격기 (AED) 표시',
      'AED 사용방법 안내',
      '"심장정지 환자에게 사용" 문구',
      '설치기관명 표시'
    ],
    side: [
      '자동심장충격기 표시',
      '관리책임자 정보',
      '패드 유효기간',
      '배터리 유효기간'
    ],
    warning: '본 장비는 응급의료에 관한 법률에 의거 설치·운영되며 파손 시 민·형사상 책임을 질 수 있음'
  };


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
              <h1 className="text-lg font-bold text-white">AED 보관함 규격 기준</h1>
            </div>
            <div className="flex items-center gap-2">
              <CubeIcon className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-gray-400">자동심장충격기 설치 및 관리 지침(제7판)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Quick Info */}
        <div className="bg-emerald-900/20 border border-emerald-600/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-emerald-400 mb-2">보관함 규격 기준</h2>
              <p className="text-sm text-gray-300">
                AED 보관함은 벽걸이형과 스탠드형 2가지 형태로 구분되며,
                설치 장소와 환경에 따라 적절한 형태를 선택하여 설치합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Storage Types */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {storageTypes.map((storage, idx) => (
            <div key={idx} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">{storage.type} 보관함</h3>
              </div>
              <div className="p-6 space-y-4">
                {/* Dimensions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-3">규격</h4>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-emerald-400">{storage.dimensions.width}</div>
                        <div className="text-xs text-gray-500">가로</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-emerald-400">{storage.dimensions.height}</div>
                        <div className="text-xs text-gray-500">세로/높이</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-emerald-400">{storage.dimensions.depth}</div>
                        <div className="text-xs text-gray-500">깊이</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">특징</h4>
                  <ul className="space-y-2">
                    {storage.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="text-emerald-400">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Common Requirements */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">공통 요구사항</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {commonRequirements.map((req, idx) => (
                <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="mb-3">
                    <h4 className="font-medium text-white">{req.category}</h4>
                  </div>
                  <ul className="space-y-1">
                    {req.requirements.map((item, iIdx) => (
                      <li key={iIdx} className="text-xs text-gray-400">• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Display Requirements */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">표시 사항</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Front Display */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="font-medium text-emerald-400 mb-3">정면 표시</h4>
                <ul className="space-y-2">
                  {displayRequirements.front.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Side Display */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="font-medium text-emerald-400 mb-3">측면 표시</h4>
                <ul className="space-y-2">
                  {displayRequirements.side.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Warning Text */}
            <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{displayRequirements.warning}</p>
              </div>
            </div>
          </div>
        </section>



        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
          >
            ← 점검 화면으로 돌아가기
          </button>
          <div className="text-sm text-gray-500">
            근거: 붙임5. 자동심장충격기 보관함 규격 (제7판)
          </div>
        </div>
      </div>
    </div>
  );
}