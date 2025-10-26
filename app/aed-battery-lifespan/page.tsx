'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, Battery100Icon, InformationCircleIcon } from '@heroicons/react/24/outline';

export default function AEDBatteryLifespanPage() {
  const router = useRouter();
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);

  const batteryData = [
    {
      id: 1,
      manufacturer: '씨유메디칼',
      lifespan: '4년',
      years: 4,
      models: ['CU-SP1', 'CU-SP2', 'i-PAD NF1200', 'i-PAD NF1201'],
      notes: '모든 모델 동일',
    },
    {
      id: 2,
      manufacturer: 'MEDIANA',
      lifespan: '4년',
      years: 4,
      models: ['HeartOn A10', 'A15', 'A16'],
      notes: '모든 모델 동일',
    },
    {
      id: 3,
      manufacturer: 'Nihon Kohden',
      lifespan: '모델별 상이',
      years: 0,
      models: [],
      details: [
        { model: 'AED-3100K', lifespan: '2년', years: 2 },
        { model: 'AED-2150K', lifespan: '4년', years: 4 },
        { model: 'AED-2152K', lifespan: '4년', years: 4 }
      ],
      notes: '모델별 확인 필수',
    },
    {
      id: 4,
      manufacturer: '나눔테크',
      lifespan: '모델별 상이',
      years: 0,
      models: [],
      details: [
        { model: '일체형 (배터리+패드)', lifespan: '2년', years: 2 },
        { model: '분리형', lifespan: '5년', years: 5 }
      ],
      notes: '일체형/분리형 구분',
    },
    {
      id: 5,
      manufacturer: '라디안큐바이오',
      lifespan: '모델별 상이',
      years: 0,
      models: [],
      details: [
        { model: '5시리즈 (HR-501, HR-503)', lifespan: '4년', years: 4 },
        { model: '7시리즈 (HR-701, HR-705)', lifespan: '5년', years: 5 }
      ],
      notes: '모델 첫 숫자로 구분',
    },
    {
      id: 6,
      manufacturer: '리젠메디칼',
      lifespan: '4년',
      years: 4,
      models: ['PARAMEDIC CU-ER1', 'CU-ER2', 'CU-ER5'],
      notes: '모든 모델 동일',
    }
  ];

  const unavailableManufacturers = ['Philips', 'GS Elektromed', 'HeartSine'];

  const importantNotes = [
    {
      title: '제조사와 판매처의 배터리 유효기간 차이',
      points: [
        '제조사에서 정한 유효기간을 판매처에서 임의 변경하는 경우 발생',
        '판매처의 임의 변경으로 설치기관의 잘못된 인식 발생',
        '동일 제조사 배터리도 설치기관별 주장이 상이할 수 있음'
      ]
    },
    {
      title: '배터리 리뉴얼 제작',
      points: [
        '신규 설치 장비 중 배터리 유효기간 날짜만 기입된 경우 존재',
        '4년 또는 5년 기준인지 확인 불가한 경우 제조사 문의 필요'
      ]
    }
  ];

  const getLifespanColor = (years: number) => {
    if (years >= 5) return 'text-green-400';
    if (years === 4) return 'text-blue-400';
    if (years === 3) return 'text-yellow-400';
    if (years === 2) return 'text-orange-400';
    return 'text-gray-400';
  };

  const getLifespanBadge = (years: number) => {
    if (years >= 5) return 'bg-green-500/20 text-green-300 border-green-500/40';
    if (years === 4) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    if (years === 3) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    if (years === 2) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm font-medium">돌아가기</span>
              </button>
              <h1 className="text-sm sm:text-lg font-bold text-white">배터리 유효기간</h1>
            </div>
            <Battery100Icon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Quick Info */}
        <div className="bg-emerald-900/20 border border-emerald-600/30 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-gray-300">
              제조사별로 배터리 유효기간이 다르며, 같은 제조사라도 모델에 따라 차이가 있을 수 있습니다.
            </p>
          </div>
        </div>

        {/* Compact Table View */}
        <section className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border-b border-gray-700">
            <h3 className="text-sm sm:text-base font-semibold text-white">제조사별 배터리 유효기간</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {batteryData.map((item) => (
              <div key={item.id} className="p-3 sm:p-4 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-sm sm:text-base truncate">{item.manufacturer}</h4>
                  </div>
                  {item.years > 0 ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${getLifespanBadge(item.years)}`}>
                      {item.lifespan}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 whitespace-nowrap">
                      {item.lifespan}
                    </span>
                  )}
                </div>

                {item.details && (
                  <div className="space-y-1.5 mb-2">
                    {item.details.map((detail, idx) => (
                      <div key={idx} className="bg-gray-800/50 rounded p-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">{detail.model}</span>
                        <span className={`text-xs font-medium whitespace-nowrap ${getLifespanColor(detail.years)}`}>
                          {detail.lifespan}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {item.models && item.models.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 mb-1">적용 모델</div>
                    <div className="flex flex-wrap gap-1">
                      {item.models.map((model, idx) => (
                        <span key={idx} className="text-xs bg-gray-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {item.notes && (
                  <div className="text-xs text-gray-400">
                    ※ {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Quick Reference Table - Compact */}
        <section className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border-b border-gray-700">
            <h3 className="text-sm sm:text-base font-semibold text-white">빠른 참조표</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-2 sm:px-3 py-2 text-left text-gray-300 font-medium">기간</th>
                  <th className="px-2 sm:px-3 py-2 text-left text-gray-300 font-medium">제조사</th>
                  <th className="px-2 sm:px-3 py-2 text-left text-gray-300 font-medium">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                <tr className="hover:bg-gray-800/30">
                  <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300">5년</span>
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-gray-300 text-xs sm:text-sm">나눔테크(분리형), 라디안큐(7)</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-500 text-xs whitespace-nowrap">최장</td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">4년</span>
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-gray-300 text-xs sm:text-sm">씨유, MEDIANA, 리젠, 라디안큐(5), Nihon(일부)</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-500 text-xs whitespace-nowrap">일반적</td>
                </tr>
                <tr className="hover:bg-gray-800/30">
                  <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300">2년</span>
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-gray-300 text-xs sm:text-sm">나눔테크(일체형), Nihon(3100K)</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-500 text-xs whitespace-nowrap">주의</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Unavailable Manufacturers - Compact */}
        <section className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border-b border-gray-700">
            <h3 className="text-sm sm:text-base font-semibold text-white">문의 불가 제조사</h3>
          </div>
          <div className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3">
              아래 제조사는 공식 정보를 제공하지 않습니다. 기기 표시 정보나 구매처를 통해 확인하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              {unavailableManufacturers.map((name, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-gray-300 text-xs sm:text-sm">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Important Notes - Compact */}
        <section className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 sm:p-4">
          <h3 className="text-sm sm:text-base font-semibold text-yellow-400 mb-2 sm:mb-3">주의사항</h3>
          <div className="space-y-3">
            {importantNotes.map((note, idx) => (
              <div key={idx} className="space-y-1">
                <h4 className="font-medium text-yellow-300 text-xs sm:text-sm">{note.title}</h4>
                <ul className="space-y-0.5 sm:space-y-1">
                  {note.points.map((point, pIdx) => (
                    <li key={pIdx} className="flex items-start gap-1.5 text-xs sm:text-sm text-gray-300">
                      <span className="text-yellow-400 mt-0.5">•</span>
                      <span className="flex-1">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Tips - Compact */}
        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3 sm:p-4">
          <h3 className="text-sm sm:text-base font-semibold text-blue-400 mb-2">점검 시 확인 방법</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-300">
            <div className="flex items-start gap-1.5">
              <span className="text-blue-400">1.</span>
              <span>배터리 표면 제조일자 확인</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-blue-400">2.</span>
              <span>제조사 및 모델명 확인</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-blue-400">3.</span>
              <span>위 표 참조하여 유효기간 계산</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-blue-400">4.</span>
              <span>불확실한 경우 제조사 문의</span>
            </div>
          </div>
        </div>

        {/* Footer - Compact */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 sm:pt-4">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            ← 돌아가기
          </button>
          <div className="text-xs sm:text-sm text-gray-500">
            출처: 자동심장충격기 제조사별 배터리 유효기간 조사
          </div>
        </div>
      </div>
    </div>
  );
}
